/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

// To use this command, the element that you want to findhas to get a: data-testid="x" and x should be given to dataTestSelector
// This makes it far easier to locate specific components of the Website
Cypress.Commands.add("getDataTestId", (dataTestSelector) => {
    return cy.get(`[data-testid="${dataTestSelector}"]`);
  });

export function setupTest(){
  if(Cypress.env('TESTENV') == "PROD"){ 
    cy.visit("https://openai.ki.fh-swf.de");
    cy.get("button").contains("Cluster Login").click()
    cy.get('input#username').type(Cypress.env("CYPRESS_USER_NAME"));
    cy.get('input#password').type(Cypress.env("CYPRESS_USER_PASSWORD"));
    cy.get("input").contains("Login Cluster").click();
  }
  else{ // if its not prod, then it selects ci
    cy.intercept('GET', "https://www.gravatar.com/8e596ec8846c54f583994b3773e0c4afc16414733b9640b29b546a41b169dcd1");
    cy.intercept('GET', "https://de.gravatar.com/8e596ec8846c54f583994b3773e0c4afc16414733b9640b29b546a41b169dcd1"); 
    cy.intercept('GET', 'https://openai.ki.fh-swf.de/api/user', { fixture: 'testUser.json' }).as('getUser');
    cy.intercept('GET', "https://openai.ki.fh-swf.de/api/login")
      .then((req) => {
        console.log(req);
      });
    cy.visit("http://localhost:5173/");
    //cy.wait('@getUser', { timeout: 15000 });
  }
}