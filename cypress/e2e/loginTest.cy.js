describe("Login Test", () => {
    beforeEach(() => {
      cy.visit("https://openai.ki.fh-swf.de");
    });
  
    it("Login", () => {
        cy.get("button").contains("Cluster Login").click()
        cy.get('input').eq(0).type("username_hier");
        cy.get('input').eq(1).type("passwort_hier");    
        //cy.get("input").contains("Login Cluster").click();
        // Der Code kann noch nicht einloggen, da hier keine Daten reingeschrieben werden
        // Diese werden noch von einem Secret in Github kommen.
    });
  });