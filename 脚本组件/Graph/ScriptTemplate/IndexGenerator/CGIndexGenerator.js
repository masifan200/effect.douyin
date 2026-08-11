'use strict';
const APJS = require('../../../amazingpro');
const {BaseNode} = require('../Utils/BaseNode');

class CGIndexGenerator extends BaseNode {
  constructor() {
    super();
    this.cachedNumberList = [];
    this.remainingExecutionCount = 1;
    this.currentIdxPointer = 0;
  }

  // Fishers and Yates Algorithm
  // https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  buildArray(lower, upper, sign, repetitionPattern, pingPong) {
    const arr = [];
    if (repetitionPattern === 'Random') {
      for (let j = lower; j <= upper; j++) {
        arr.push(Math.floor(Math.random() * (upper - lower + 1)) + lower);
      }
    } else {
      for (let j = lower; j <= upper; j++) {
        arr.splice(sign > 0 ? arr.length : 0, 0, j);
      }
      if (repetitionPattern === 'Shuffle') {
        this.shuffleArray(arr);
      }
    }
    return arr;
  }

  execute(index) {
    // Reset Case
    if (index === 1) {
      this.currentIdxPointer = 0;
      this.cachedNumberList = [];
      this.remainingExecutionCount = 1;
      return;
    }

    const randomFrom = this.inputs[2]();
    const randomTo = this.inputs[3]();
    const repetitionPattern = this.inputs[4]();
    const loopCount = this.inputs[5]();
    const pingPong = this.inputs[6]();

    if (
      randomFrom === null ||
      randomFrom === undefined ||
      randomTo === null ||
      randomTo === undefined ||
      loopCount === null ||
      loopCount === undefined ||
      loopCount === 0 ||
      repetitionPattern === null ||
      repetitionPattern === undefined ||
      pingPong === null ||
      pingPong === undefined
    ) {
      return;
    }

    if (repetitionPattern !== 'Loop' && repetitionPattern !== 'Random' && repetitionPattern !== 'Shuffle') {
      return;
    }

    // Execution depleted
    if (this.remainingExecutionCount === 0) {
      return;
    }

    // Clamp Upper and Lower index to be > 0
    // Handling the case where from > to, e.g. from 5 to 1
    const upper = Math.max(Math.ceil(Math.max(randomFrom, randomTo)), 0);
    const lower = Math.max(Math.floor(Math.min(randomFrom, randomTo)), 0);
    const sign = Math.sign(randomTo - randomFrom);

    // initialize array
    if (this.cachedNumberList.length === 0) {
      this.cachedNumberList = this.buildArray(lower, upper, sign, repetitionPattern, pingPong);
      this.currentIdxPointer = 0;
      this.remainingExecutionCount = loopCount;
    }

    // when reach a single loop end
    if (
      (this.currentIdxPointer === this.cachedNumberList.length && !pingPong) ||
      (this.currentIdxPointer === this.cachedNumberList.length * 2 && pingPong)
    ) {
      if (loopCount > 0) {
        this.remainingExecutionCount--;
      }
      if (this.remainingExecutionCount === 0) {
        return;
      }

      // only rebuild array if it's the completely random case
      if (repetitionPattern === 'Random') {
        this.cachedNumberList = this.buildArray(lower, upper, sign, repetitionPattern, pingPong);
      }

      // shuffle array in-place  when in Shuffle mode without rebuilding
      if (repetitionPattern === 'Shuffle') {
        this.shuffleArray(this.cachedNumberList);
      }

      this.currentIdxPointer = 0;
    }

    let indexPointer = this.currentIdxPointer;

    if (pingPong && indexPointer >= this.cachedNumberList.length) {
      indexPointer = this.cachedNumberList.length * 2 - 1 - indexPointer;
    }

    this.outputs[1] = this.cachedNumberList[indexPointer];
    this.outputs[2] = this.currentIdxPointer;

    this.currentIdxPointer++;

    if (this.nexts[0]) {
      this.nexts[0]();
    }
  }

  resetOnRecord(sys) {
    this.currentIdxPointer = 0;
    this.cachedNumberList = [];
    this.remainingExecutionCount = 1;
    this.outputs[1] = 0;
  }
}

exports.CGIndexGenerator = CGIndexGenerator;
