'use strict';

const mongoose = require('mongoose');
const Block = require('./block');
const httpErrors = require('http-errors');
const Hashes = require('jshashes');
const superagent = require('superagent');
const apiURL = `http://localhost:${process.env.PORT}`;

const chainSchema = mongoose.Schema({
  currentChainArray: [],
});

// Nicholas - this is the main functionality- it builds a new, valid block which can be posted to the other running servers and checked against them.
chainSchema.methods.runBlockFactory = function(ledgerArray){
  if(!ledgerArray.length){
    return console.log('block Factory closed');
  }else {
    // console.log(ledgerArray);
    let ledger = ledgerArray.shift();
    // console.log(ledger);
    let newBlock = this.makeNextBlock(ledger);
    return superagent.post(`${apiURL}/block`)
      .send(newBlock)
      .then(response => {
        if(response.status === 200){
          // console.log(this.currentChainArray);
          this.currentChainArray.push(newBlock);
          // console.log(this.currentChainArray);
          return this.runBlockFactory(ledgerArray);
        }
      });
  }
};
chainSchema.methods.makeGenesisBlock = function() {
  if(this.currentChainArray.length > 0) {
    console.log('Genesis Block Already Exists');
    return;
  }
  let index = 0;
  let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';
  let timeStamp = 'genesisDate';
  let ledger = 'genesisLedger';
  let nonce = 0;

  let currentHash = this.makeBlockHash(index, timeStamp, previousHash, ledger, nonce);

  while (currentHash.slice(0, 3) !== '000') {
    nonce++;
    currentHash = this.makeBlockHash(index, timeStamp, previousHash, ledger, nonce);
  }
  // console.log('genesis hash: ', currentHash, 'nonce: ', nonce);

  let genesis = new Block(index, previousHash, timeStamp, ledger, currentHash, nonce);
  this.currentChainArray.push(genesis);
  this.save();
  return this;

};

chainSchema.methods.makeNextBlock = function(ledger){
  let latestBlock = this.currentChainArray[this.currentChainArray.length - 1];
  return this._makeNextBlock(latestBlock, ledger);
};

chainSchema.methods._makeNextBlock = function(latestBlock, ledger){
  let nextIndex = latestBlock.index + 1;
  let timeStamp = new Date().toString();
  let nonce = 0;
  let newHash = this.makeBlockHash(nextIndex, timeStamp, latestBlock.currentHash, ledger, nonce);
  while (newHash.slice(0, 3) !== '000') {
    nonce++;
    newHash = this.makeBlockHash(nextIndex, timeStamp, latestBlock.currentHash, ledger, nonce);
  }
  // console.log('new hash: ', newHash, 'nonce: ', nonce);

  return new Block(nextIndex, latestBlock.currentHash, timeStamp, ledger, newHash, nonce);
};

chainSchema.methods._addNextBlock = function(block) {
  if (this.checkBlockValidity(block) === false) {
    console.log('your block is broken');
    throw new httpErrors(400, 'invalid information in block');
  } else {
    console.log('adding a new block to chain');
    this.currentChainArray.push(block);
    return this;
  }
};

chainSchema.methods.makeBlockHash = function(index, timeStamp, previousHash, ledger, nonce){
  let SHA256 = new Hashes.SHA256;
  let nextHash = SHA256.b64(index + timeStamp + previousHash + ledger);
  let nonceHash = SHA256.b64(nextHash + nonce);
  return nonceHash;
};

chainSchema.methods.calculateHashForBlock = function(block){

  let hashToCheck = this.makeBlockHash(block.index, block.timeStamp, block.previousHash, block.ledger, block.nonce);
  return hashToCheck;
};

chainSchema.methods.checkBlockValidity = function(block){ //TODO: refactor console logs as error throws
  if(!this.currentChainArray[block.index - 1]){
    console.log('invalid index');
    return false;
  }
  if(this.currentChainArray[block.index - 1].currentHash !== block.previousHash){
    console.log('invalid previous currentHash');
    return false;
  }
  if (this.calculateHashForBlock(block) !== block.currentHash){
    console.log('invalid currentHash');
    return false;
  }
  console.log('Block is valid');
  return true;
};


// chainSchema.methods.checkChainValidity = function (updatedChain, stableChain) {
//   if (stableChain.currentChainArray[0] !== updatedChain.currentChainArray[0]) {
//     return false;
//   }

//   for (let block in updatedChain.currentChainArray) {
//     if (!this.checkBlockValidity(block)) return false;
//   }
//   return true;
// };

module.exports = mongoose.model('chain', chainSchema);
