import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { TapestryState } from "./state.js";
import { TapestryExtractionSchema, TapestryNode, TapestryEdge } from "./schema.js";
import { v4 as uuidv4 } from "uuid";

type ExtractionResult = z.infer<typeof TapestryExtractionSchema>;

export function applyExtractionResult(
  currentNodes: TapestryNode[],
  currentEdges: TapestryEdge[],
  result: ExtractionResult
): { nodes: TapestryNode[]; edges: TapestryEdge[] } {
  const updatedNodes = [...currentNodes];
  let updatedEdges = [...currentEdges];

  // 1. Process New Nodes (or update existing)
  result.extractedNodes.forEach(newNode => {
    const cleanedAttributes = Object.fromEntries(
      Object.entries(newNode.attributes || {}).filter(([_, v]) => v !== null)
    );
    const existing = updatedNodes.find(n => n.label.toLowerCase() === newNode.label.toLowerCase());
    if (existing) {
      existing.attributes = { ...existing.attributes, ...cleanedAttributes };
      if (newNode.description) existing.description = newNode.description;
    } else {
      updatedNodes.push({
        id: uuidv4(),
        label: newNode.label,
        type: newNode.type,
        description: newNode.description || '',
        attributes: cleanedAttributes
      });
    }
  });

  // 2. Process New Edges
  const pendingRemovals = [...(result.edgesToRemove ?? [])];
  result.extractedEdges.forEach(newEdge => {
    const source = updatedNodes.find(n => n.label.toLowerCase() === newEdge.sourceLabel.toLowerCase());
    const target = updatedNodes.find(n => n.label.toLowerCase() === newEdge.targetLabel.toLowerCase());
    if (source && target) {
      if (newEdge.predicate.toUpperCase().startsWith("NOT_")) {
        pendingRemovals.push({
          sourceLabel: newEdge.sourceLabel,
          targetLabel: newEdge.targetLabel,
          predicate: newEdge.predicate.substring(4)
        });
      } else {
        updatedEdges.push({
          id: uuidv4(),
          sourceId: source.id,
          targetId: target.id,
          predicate: newEdge.predicate
        } as TapestryEdge);
      }
    }
  });

  // 3. Process Edge Removals
  pendingRemovals.forEach(edgeToRemove => {
    const source = updatedNodes.find(n => n.label.toLowerCase() === edgeToRemove.sourceLabel.toLowerCase());
    const target = updatedNodes.find(n => n.label.toLowerCase() === edgeToRemove.targetLabel.toLowerCase());
    if (source && target) {
      updatedEdges = updatedEdges.filter(e =>
        !(e.sourceId === source.id && e.targetId === target.id && e.predicate === edgeToRemove.predicate)
      );
    }
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

// ─── Geocoding ───────────────────────────────────────────────────────────────

async function nominatimGeocode(name: string): Promise<{ x: number; y: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Tapestry/1.0 (knowledge graph application)' }
    });
    if (!response.ok) return null;
    const data = await response.json() as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { x: parseFloat(data[0].lon), y: parseFloat(data[0].lat) };
  } catch {
    return null;
  }
}

async function geocodeMissingPlaces(nodes: TapestryNode[], previousNodeIds: Set<string>): Promise<TapestryNode[]> {
  // Only geocode Place nodes that are either new or still missing coordinates
  const toGeocode = nodes.filter(
    n => n.type === 'Place' && !n.attributes['coordinates'] && !n.attributes['_geocodeFailed']
  );
  if (toGeocode.length === 0) return nodes;

  console.log(`[geocode] Looking up coordinates for ${toGeocode.length} place(s)...`);
  const updatedNodes = [...nodes];

  for (const place of toGeocode) {
    const coords = await nominatimGeocode(place.label);
    if (coords) {
      const idx = updatedNodes.findIndex(n => n.id === place.id);
      if (idx !== -1) {
        updatedNodes[idx] = {
          ...updatedNodes[idx],
          attributes: { ...updatedNodes[idx].attributes, coordinates: coords }
        };
        console.log(`[geocode] ✓ ${place.label} → (${coords.y.toFixed(4)}, ${coords.x.toFixed(4)})`);
      }
    } else {
      console.log(`[geocode] ✗ ${place.label} — not found`);
      const idx = updatedNodes.findIndex(n => n.id === place.id);
      if (idx !== -1) {
        updatedNodes[idx] = {
          ...updatedNodes[idx],
          attributes: { ...updatedNodes[idx].attributes, _geocodeFailed: true }
        };
      }
    }
    // Nominatim ToS: max 1 request per second
    await new Promise(r => setTimeout(r, 1100));
  }

  return updatedNodes;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function sanitizeForPrompt(nodes: TapestryNode[]): object[] {
  return nodes.map(({ id, label, type, description, attributes }) => ({
    id, label, type, description,
    attributes: Object.fromEntries(
      Object.entries(attributes).filter(([k]) => !k.startsWith('_'))
    ),
  }));
}

// ─── Extraction node ─────────────────────────────────────────────────────────

export async function extractionNode(state: typeof TapestryState.State) {
  const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
  const structuredModel = model.withStructuredOutput(TapestryExtractionSchema, { name: "extract_tapestry_v2", strict: true });

  // Compact node list: just "Label (Type)" — enough for entity resolution, far fewer tokens than full JSON
  const nodeList = state.nodes.length > 0
    ? state.nodes.map(n => `${n.label} (${n.type})`).join(', ')
    : 'none yet';

  const systemPrompt = `You are the Loom. Extract ALL entities and relationships from the text into the knowledge graph. Be exhaustive — it is better to extract too much than to miss something.

    Existing entities (do not duplicate): ${nodeList}

    Rules:
    1. Extract EVERY named entity: every person, organization, place, concept, object, and event mentioned — including minor figures and supporting details.
    2. Entity Resolution: If an entity already exists (match label case-insensitively), UPDATE it with new info instead of creating a duplicate.
    3. Attributes: Record all factual details as attributes. Events MUST use 'startTime' and 'endTime'. Dates are ALWAYS attributes — never standalone nodes. No 'timestamp' attribute.
    4. Links: Create an edge for EVERY relationship mentioned, explicit or implied. Capture even weak connections ("associated with", "contemporary of", "participated in").
    5. Follow-up: Ask one targeted question to uncover missing connections.
    6. Deletions: If the user says X is NOT related to Y, put it in 'edgesToRemove'. Never use a 'NOT_' predicate.`;

  const result = await structuredModel.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  const previousNodeIds = new Set(state.nodes.map(n => n.id));
  const { nodes: extractedNodes, edges } = applyExtractionResult(state.nodes, state.edges, result);
  const nodes = await geocodeMissingPlaces(extractedNodes, previousNodeIds);

  return {
    nodes,
    edges,
    nextPrompt: result.suggestedFollowUp
  };
}
