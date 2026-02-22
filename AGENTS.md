# Agent Instructions: Angular Best Practices

When working on this project (specifically the Angular frontend codebase), please strictly adhere to the following modern Angular practices and preferences.

## 1. State Management and Reactivity

- **Signals First:** General preference to use Angular Signals (`signal()`, `computed()`, `effect()`) for state management and reactivity whenever possible, moving away from RxJS `BehaviorSubject` or traditional component properties unless RxJS is strictly required for complex asynchronous streams.

## 2. Component APIs

- **Signal Inputs:** Use the new Signal-based `input()` API instead of the traditional `@Input()` decorator.
- **Output Function:** Use the new `output()` function instead of `@Output()` with `EventEmitter`.
- **Signal Queries:** Use Signal-based queries like `viewChild()`, `viewChildren()`, `contentChild()`, and `contentChildren()` instead of `@ViewChild()`, `@ViewChildren()`, `@ContentChild()`, and `@ContentChildren()`.

## 3. Dependency Injection

- **`inject()` Function:** Always prefer using the `inject()` function for dependency injection over traditional constructor-based injection.

## 4. Templating

- **Control Flow Syntax:** Always use the new built-in block-based control flow syntax (`@if`, `@else if`, `@else`, `@for`, `@switch`, `@case`, `@default`) rather than structural directives like `*ngIf`, `*ngFor`, or `*ngSwitch`.
- **Self-Closing Tags:** Use self-closing tags for both standard HTML elements and Angular components that do not contain child content (e.g., use `<app-my-component />` rather than `<app-my-component></app-my-component>`).

## 5. Routing

- **Lazy-Loaded Routes:** Make use of lazy-loaded routes using the modern `loadComponent` or `loadChildren` syntax with `import()` to ensure optimal bundle sizes and performance.
