const APJS = require('../../../amazingpro');
const {BaseNode} = require('../Utils/BaseNode');

class CGMakeArray extends BaseNode {
  constructor() {
    super();
  }

  getOutput() {
    const array = [];
    for (let i = 0; i < this.inputs.length; ++i) {
      if (this.inputs[i] === null || this.inputs[i] === undefined) {
        continue;
      }
      array.push(this.inputs[i]());
    }
    return array;
  }
}

exports.CGMakeArray = CGMakeArray;
