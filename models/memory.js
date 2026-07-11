const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  messages: [{
    sender: {
      type: String,
      enum: ['user', 'bot']
    },
    text: String,
    time: String
  }],
  facts: [{
    fact: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  trades: [{
    asset: String,
    recommendation: String,
    confidence: Number,
    reasoning: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

MemorySchema.index({ userId: 1, lastActive: -1 });

MemorySchema.statics.getOrCreate = async function(userId) {
  let memory = await this.findOne({ userId });
  if (!memory) {
    memory = await this.create({
      userId,
      messages: [],
      facts: [],
      trades: []
    });
  }
  return memory;
};

MemorySchema.methods.addMessage = async function(sender, text) {
  const lastMessage = this.messages[this.messages.length - 1];
  if (lastMessage && lastMessage.text === text && lastMessage.sender === sender) {
    console.log('⚠️ Duplicate message detected, skipping...');
    return this;
  }
  
  const time = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  this.messages.push({ sender, text, time });
  this.lastActive = new Date();
  if (this.messages.length > 200) {
    this.messages = this.messages.slice(-200);
  }
  await this.save();
  return this;
};

MemorySchema.methods.addFact = async function(fact) {
  this.facts.push({ fact });
  await this.save();
  return this;
};

MemorySchema.methods.addTrade = async function(asset, recommendation, confidence, reasoning) {
  this.trades.push({ asset, recommendation, confidence, reasoning });
  await this.save();
  return this;
};

MemorySchema.methods.getHistory = function(limit = 20) {
  return this.messages.slice(-limit);
};

MemorySchema.methods.clearMemory = async function() {
  this.messages = [];
  this.facts = [];
  this.trades = [];
  this.lastActive = new Date();
  await this.save();
  return this;
};

const Memory = mongoose.model('Memory', MemorySchema);
module.exports = Memory;