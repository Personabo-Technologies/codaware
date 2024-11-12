// mention-utils.js
export const mentionRegex = />((?:\/|\w+:\/\/)[^\s]+?|problems\b)(?=[.,;:!?]?(?=[\s\r\n]|$))/
export const mentionRegexGlobal = new RegExp(mentionRegex.source, "g")
