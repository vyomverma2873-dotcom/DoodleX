class WordBank {
  constructor() {
    this.words = {
      easy: [
        // Super simple shapes & objects (3-5 letters, very recognizable)
        'sun', 'moon', 'star', 'tree', 'cat', 'dog', 'fish', 'bird', 'egg', 'cup',
        'hat', 'ball', 'box', 'key', 'bed', 'door', 'book', 'sock', 'boat', 'kite',
        'cake', 'pie', 'ice', 'bus', 'car', 'van', 'ant', 'bee', 'bug', 'pig',
        'cow', 'hen', 'bat', 'owl', 'fox', 'bag', 'pen', 'fan', 'bow', 'web',
        'pot', 'pan', 'jar', 'mug', 'rug', 'map', 'can', 'log', 'axe', 'saw',
        
        // Easy everyday objects (recognizable shapes)
        'apple', 'banana', 'grape', 'lemon', 'cherry', 'pizza', 'bread', 'candy',
        'house', 'chair', 'table', 'clock', 'phone', 'lamp', 'spoon', 'fork',
        'heart', 'cloud', 'rain', 'snow', 'fire', 'leaf', 'flower', 'grass',
        'smile', 'face', 'hand', 'foot', 'nose', 'ear', 'eye', 'teeth', 'bone',
        
        // Simple animals (easy to draw)
        'frog', 'duck', 'bear', 'lion', 'mouse', 'snake', 'worm', 'crab', 'snail',
        'shark', 'whale', 'bunny', 'panda', 'monkey', 'horse', 'sheep', 'goat',
        'turtle', 'tiger', 'zebra', 'hippo', 'giraffe', 'penguin', 'chicken',
        
        // Simple objects
        'bell', 'ring', 'crown', 'gift', 'candy', 'cookie', 'donut', 'burger',
        'pizza', 'taco', 'hotdog', 'fries', 'popcorn', 'cupcake', 'icecream',
        'shoe', 'boot', 'shirt', 'pants', 'dress', 'glasses', 'watch', 'belt',
        'brush', 'comb', 'soap', 'towel', 'mirror', 'pillow', 'blanket',
        
        // Easy transportation
        'bike', 'train', 'plane', 'ship', 'truck', 'taxi', 'rocket', 'wheel',
        
        // Nature & outdoor
        'rock', 'hill', 'pond', 'river', 'beach', 'wave', 'sand', 'shell',
        'tent', 'fence', 'bridge', 'path', 'bench', 'swing', 'slide', 'pool',
        
        // Simple tools & items
        'hammer', 'nail', 'rope', 'ladder', 'bucket', 'shovel', 'broom', 'mop',
        'scissors', 'tape', 'glue', 'paper', 'pencil', 'crayon', 'eraser',
        'camera', 'TV', 'radio', 'guitar', 'drum', 'piano', 'balloon', 'dice',
        
        // Food items (simple shapes)
        'egg', 'milk', 'cheese', 'butter', 'rice', 'corn', 'peas', 'carrot',
        'onion', 'potato', 'tomato', 'mushroom', 'pepper', 'olive', 'pickle',
        
        // Simple buildings/places
        'barn', 'castle', 'church', 'school', 'hospital', 'store', 'park', 'zoo'
      ],
      medium: [
        // Actions (easy to act out in drawing)
        'sleeping', 'running', 'jumping', 'dancing', 'singing', 'eating',
        'reading', 'writing', 'cooking', 'swimming', 'fishing', 'camping',
        'flying', 'crying', 'laughing', 'waving', 'hugging', 'kissing',
        'throwing', 'catching', 'kicking', 'climbing', 'sliding', 'swinging',
        
        // Slightly harder objects
        'rainbow', 'snowman', 'scarecrow', 'windmill', 'lighthouse', 'volcano',
        'mountain', 'island', 'waterfall', 'fountain', 'campfire', 'sunset',
        'sunrise', 'starfish', 'jellyfish', 'octopus', 'butterfly', 'ladybug',
        'dragonfly', 'caterpillar', 'grasshopper', 'spider', 'scorpion',
        
        // Fantasy creatures
        'dragon', 'unicorn', 'mermaid', 'fairy', 'ghost', 'monster', 'robot',
        'alien', 'witch', 'wizard', 'ninja', 'pirate', 'knight', 'princess',
        'angel', 'devil', 'vampire', 'zombie', 'skeleton', 'mummy',
        
        // Professions (can show with props)
        'doctor', 'nurse', 'teacher', 'chef', 'farmer', 'police', 'firefighter',
        'pilot', 'sailor', 'cowboy', 'clown', 'artist', 'singer', 'dancer',
        
        // Sports & activities
        'soccer', 'football', 'baseball', 'basketball', 'tennis', 'golf',
        'bowling', 'skiing', 'surfing', 'skating', 'boxing', 'wrestling',
        'archery', 'diving', 'hiking', 'yoga', 'karate', 'gymnastics',
        
        // Medium objects
        'umbrella', 'backpack', 'suitcase', 'treasure', 'medal', 'trophy',
        'telescope', 'microscope', 'magnet', 'compass', 'flashlight', 'lantern',
        'candle', 'matches', 'fireworks', 'parachute', 'helicopter', 'submarine',
        'motorcycle', 'skateboard', 'scooter', 'ambulance', 'firetruck',
        
        // Musical instruments
        'violin', 'trumpet', 'flute', 'harp', 'saxophone', 'tambourine',
        'xylophone', 'accordion', 'harmonica', 'microphone', 'headphones',
        
        // Buildings
        'pyramid', 'igloo', 'treehouse', 'skyscraper', 'stadium', 'airport',
        'library', 'museum', 'theater', 'restaurant', 'bakery', 'pharmacy',
        
        // Nature
        'tornado', 'hurricane', 'earthquake', 'avalanche', 'lightning',
        'thunder', 'blizzard', 'desert', 'jungle', 'forest', 'swamp', 'cave',
        
        // Holidays & celebrations
        'birthday', 'wedding', 'christmas', 'halloween', 'easter', 'valentine',
        'pumpkin', 'snowflake', 'present', 'balloon', 'confetti', 'candles',
        
        // Technology
        'computer', 'laptop', 'keyboard', 'printer', 'smartphone', 'tablet',
        'gamepad', 'joystick', 'headset', 'speaker', 'charger', 'battery'
      ]
    };
    
    this.usedWords = new Set();
    this.hintCache = new Map(); // word -> array of hint stages
  }
  
  getRandomWord(difficulty = 'medium') {
    const wordList = this.words[difficulty] || this.words.medium;
    const availableWords = wordList.filter(w => !this.usedWords.has(w));
    
    // Reset if all words used
    if (availableWords.length === 0) {
      this.usedWords.clear();
      return this.getRandomWord(difficulty);
    }
    
    const word = availableWords[Math.floor(Math.random() * availableWords.length)];
    this.usedWords.add(word);
    
    // Pre-generate hint stages for this word
    this.generateHintStages(word);
    
    return word;
  }
  
  /**
   * Generate progressive hint stages for a word
   * Stage 0: All blanks (e.g., "_ _ _ ")
   * Stage 1: First letter revealed (e.g., "c _ _ ")
   * Stage 2: First + last letter (e.g., "c _ t ")
   * Stage 3: ~50% letters revealed (e.g., "c a _")
   */
  generateHintStages(word) {
    const letters = word.split('');
    const letterIndices = []; // Non-space indices
    
    letters.forEach((char, i) => {
      if (char !== ' ') letterIndices.push(i);
    });
    
    if (letterIndices.length === 0) {
      this.hintCache.set(word, [word]);
      return;
    }
    
    const stages = [];
    const revealedIndices = new Set();
    
    // Stage 0: All blanks
    stages.push(this.formatHint(letters, revealedIndices));
    
    // Stage 1: Reveal first letter
    revealedIndices.add(letterIndices[0]);
    stages.push(this.formatHint(letters, revealedIndices));
    
    // Stage 2: Reveal last letter (if different from first)
    if (letterIndices.length > 1) {
      revealedIndices.add(letterIndices[letterIndices.length - 1]);
      stages.push(this.formatHint(letters, revealedIndices));
    }
    
    // Stage 3: Reveal ~50% of letters (prioritize vowels for helpfulness)
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const targetReveal = Math.ceil(letterIndices.length * 0.5);
    
    // Add more letters until we hit target
    const remainingIndices = letterIndices.filter(i => !revealedIndices.has(i));
    
    // Prioritize vowels
    for (const idx of remainingIndices) {
      if (vowels.includes(letters[idx].toLowerCase()) && revealedIndices.size < targetReveal) {
        revealedIndices.add(idx);
      }
    }
    
    // Fill with random consonants if needed
    const shuffledRemaining = remainingIndices
      .filter(i => !revealedIndices.has(i))
      .sort(() => Math.random() - 0.5);
    
    for (const idx of shuffledRemaining) {
      if (revealedIndices.size >= targetReveal) break;
      revealedIndices.add(idx);
    }
    
    stages.push(this.formatHint(letters, revealedIndices));
    
    this.hintCache.set(word, stages);
  }
  
  /**
   * Format a hint string with revealed and hidden letters
   */
  formatHint(letters, revealedIndices) {
    return letters.map((char, i) => {
      if (char === ' ') return ' ';
      return revealedIndices.has(i) ? char : '_';
    }).join('');
  }
  
  /**
   * Get hint for a word at a specific stage (0-3)
   * @param {string} word - The word to get hint for
   * @param {number} stage - Hint stage (0 = all blank, 3 = most revealed)
   * @returns {string} The hint string
   */
  getHintAtStage(word, stage) {
    // Generate hints if not cached
    if (!this.hintCache.has(word)) {
      this.generateHintStages(word);
    }
    
    const stages = this.hintCache.get(word);
    const clampedStage = Math.min(stage, stages.length - 1);
    return stages[clampedStage] || stages[0];
  }
  
  /**
   * Get hint stage based on time elapsed and total time
   * @param {number} elapsed - Seconds elapsed
   * @param {number} total - Total seconds in round
   * @returns {number} Hint stage (0-3)
   */
  getHintStageFromTime(elapsed, total) {
    const progress = elapsed / total;
    
    if (progress < 0.25) return 0;  // First 25%: no hints
    if (progress < 0.5) return 1;   // 25-50%: first letter
    if (progress < 0.75) return 2;  // 50-75%: first + last
    return 3;                        // 75-100%: half revealed
  }
  
  /**
   * Original getWordHint for backwards compatibility
   * Returns word with roughly 1/3 of letters shown
   */
  getWordHint(word) {
    const letters = word.split('');
    const showCount = Math.max(1, Math.floor(letters.length / 3));
    const hiddenIndices = new Set();
    
    while (hiddenIndices.size < letters.length - showCount) {
      const idx = Math.floor(Math.random() * letters.length);
      if (letters[idx] !== ' ') {
        hiddenIndices.add(idx);
      }
    }
    
    return letters.map((l, i) => hiddenIndices.has(i) ? '_' : l).join('');
  }
  
  addCustomWords(category, words) {
    if (!this.words[category]) {
      this.words[category] = [];
    }
    this.words[category].push(...words);
  }
}

module.exports = { WordBank };
