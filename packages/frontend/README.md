# Tapestry

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Environments

This application is configured to run in two environments:

### Development

- **URL**: `http://localhost:4200`
- **API URL**: `http://localhost:3000` (Local Node.js server)
- **Command**: `ng serve`

### Production (GitHub Pages)

- **URL**: [https://jbrecht.github.io/tapestry/](https://jbrecht.github.io/tapestry/)
- **API URL**: `https://tapestry-serve-production.up.railway.app` (Railway Production Server)
- **Command**: `npm run deploy`

## Deployment

To deploy the application to GitHub Pages:

1. Ensure all changes are committed.
2. Run the deployment script:
   ```bash
   npm run deploy
   ```
   This script builds the application for production with the correct base HREF (`/tapestry/`) and pushes the output to the `gh-pages` branch.

> **Note**: The deployment process requires a Node.js version compatible with Angular CLI v21 (`^20.19.0` or `>=22.12.0`). If you encounter build errors, check your Node.js version.
