import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TapestryStore } from '../../store/tapestry.store';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent {
  store = inject(TapestryStore);
  newProjectName = signal('');

  startProject() {
    if (this.newProjectName().trim()) {
      this.store.startNewProject(this.newProjectName().trim());
      this.newProjectName.set('');
    }
  }

  onSwitchProject(name: string) {
    if (!this.store.projectName() || name !== this.store.projectName()) {
      this.store.switchProject(name);
    }
  }
}
