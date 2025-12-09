// Basic profanity filter - add more words as needed
const profanityList = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'crap', 'dick', 'cock', 'pussy',
  'bastard', 'slut', 'whore', 'nigger', 'faggot', 'retard',
  // Hindi profanity (common ones)
  'chutiya', 'madarchod', 'behenchod', 'bhosdi', 'gandu', 'randi', 'harami',
  'lund', 'chut', 'gaand', 'bc', 'mc', 'bsdk', 'bkl'
];

const profanityRegex = new RegExp(
  profanityList.map(word => `\\b${word}\\b`).join('|'),
  'gi'
);

function filterProfanity(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text.replace(profanityRegex, match => '*'.repeat(match.length));
}

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  return profanityRegex.test(text);
}

// Sanitize HTML to prevent XSS
function sanitizeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  filterProfanity,
  containsProfanity,
  sanitizeHtml
};
