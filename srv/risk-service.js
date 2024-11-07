
// Import the cds facade object (https://cap.cloud.sap/docs/node.js/cds-facade)
const cds = require('@sap/cds');
// connect to remote service


class RiskService extends cds.ApplicationService {

   

    async init() {
        const { Risks, BusinessPartners } = this.entities;

        this.BPsrv = await cds.connect.to("API_BUSINESS_PARTNER");

        this.on("READ", BusinessPartners, async (req) => {           
           const bps = await this.readBP(req)
           return bps
        });
        
        this.after("READ", Risks, this.setCriticality);
        // Risks?$expand=bp (Expand on BusinessPartner)
        this.on("READ", Risks, async (req, next) => { 
            return this.expandBP( req, next)
        })

        await super.init();
    }

    async readBP(req){
        
         // The API Sandbox returns alot of business partners with empty names.
            // We don't want them in our application
            req.query.where("LastName <> '' and FirstName <> '' ");
    
            return await this.BPsrv.transaction(req).send({
                query: req.query,
                headers: {
                    apikey: process.env.apikey,
                },
            });
    }

     expandBP = async (req, next) =>  {
        /*
         Check whether the request wants an "expand" of the business partner
         As this is not possible, the risk entity and the business partner entity are in different systems (SAP BTP and S/4 HANA Cloud), 
         if there is such an expand, remove it
       */
         if (!req.query.SELECT.columns) return next();

         const expandIndex = req.query.SELECT.columns.findIndex(
             ({ expand, ref }) => expand && ref[0] === "bp"
         );
 
         if (expandIndex < 0) return next();
 
         // Remove expand from query
         req.query.SELECT.columns.splice(expandIndex, 1);
         console.log(req.query.SELECT.columns)
         // Make sure bp_BusinessPartner (ID) will be returned
         if (!req.query.SELECT.columns.find((column) =>
            column.ref && column.ref.find((ref) => ref == "bp_BusinessPartner")
         )
         ) {
             req.query.SELECT.columns.push({ ref: ["bp_BusinessPartner"] });
         }
 
         const risks = await next();
 
         const asArray = x => Array.isArray(x) ? x : [x];
 
         // Request all associated BusinessPartners
         const bpIDs = asArray(risks).map(risk => risk.bp_BusinessPartner);
         const busienssPartners = await this.BPsrv.transaction(req).send({
             query: SELECT.from(this.entities.BusinessPartners).where({ BusinessPartner: bpIDs }),
             headers: {
                 apikey: process.env.apikey,
             }
         });
 
         // Convert in a map for easier lookup
         const bpMap = {};
         for (const businessPartner of busienssPartners)
             bpMap[businessPartner.BusinessPartner] = businessPartner;
 
         // Add BusinessPartners to result
         for (const note of asArray(risks)) {
             note.bp = bpMap[note.bp_BusinessPartner];
         }
 
         return risks;
    };
    
    // Método para definir a criticalidade e a prioridade
    setCriticality(data) {
        const risks = Array.isArray(data) ? data : [data];

        risks.forEach((risk) => {
            risk.criticality = risk.impact >= 100000 ? 1 : 2;

            switch (risk.prio_code) {
                case 'H':
                    risk.PrioCriticality = 1;
                    break;
                case 'M':
                    risk.PrioCriticality = 2;
                    break;
                case 'L':
                    risk.PrioCriticality = 3;
                    break;
            }
        });
    }
}

module.exports = RiskService;

// const cds = require('@sap/cds')

// // The service implementation with all service handlers
// module.exports = cds.service.impl(async function() {

//     // Define constants for the Risk and BusinessPartner entities from the risk-service.cds file
//     const { Risks, BusinessPartners } = this.entities;

//     // This handler will be executed directly AFTER a READ operation on RISKS
//     // With this we can loop through the received data set and manipulate the single risk entries
//     this.after("READ", Risks, (data) => {
//         // Convert to array, if it's only a single risk, so that the code won't break here
//         const risks = Array.isArray(data) ? data : [data];

//         // Looping through the array of risks to set the virtual field 'criticality' that you defined in the schema
//         risks.forEach((risk) => {
//             if( risk.impact >= 100000) {
//                 risk.criticality = 1;
//             } else {
//                 risk.criticality = 2;
//             }

//             // set criticality for priority
//             switch (risk.prio_code) {
//                 case 'H':
//                     risk.PrioCriticality = 1;
//                     break;
//                 case 'M':
//                     risk.PrioCriticality = 2;
//                     break;
//                 case 'L':
//                     risk.PrioCriticality = 3;
//                     break;
//                 default:
//                     break;
//             }

//         })
//     })
//   });