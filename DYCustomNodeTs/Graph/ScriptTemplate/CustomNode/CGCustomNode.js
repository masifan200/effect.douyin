//Default CustomNode Js File
const {BaseNode} = require('./BaseNode');

var global = {}; 

class CGCustomNode extends BaseNode {    
    async startUserEnvironment(script_scope) 
    {
         var script = script_scope;  
         //this === global
         console.log('Default Custom Node is executed');
    }
    
    constructor() {   
        super();
        console.log('Default Custom Node is Created');
    }
    
    execute(sys, index) {
        //unbind effect.Amaz
        this.startUserEnvironment.apply(global, [this]).then((result) => {
            console.log('Default Custom Node is then executed');
        })
        .catch(e=> {
           console.error(e);
        });
        //bind effect.Amaz

        if (this.nexts[0]) {
            this.nexts[0]();
        }
    }
}
exports.CGCustomNode = CGCustomNode;