/**
 * Function provided under the MIT License
 * Copyright (c) 2016-20 Ionică Bizău <bizauionica@gmail.com> (https://ionicabizau.net)
 * https://github.com/IonicaBizau/emoji-unicode/blob/master/LICENSE
 */
export function toCodepoint(input: string) {
  if (input.length === 1) {
    return input.charCodeAt(0).toString(16);
  } else if (input.length > 1) {
    const pairs = [];
    for (let i = 0; i < input.length; i++) {
      if (
        // high surrogate
        input.charCodeAt(i) >= 0xd800 &&
        input.charCodeAt(i) <= 0xdbff
      ) {
        if (
          input.charCodeAt(i + 1) >= 0xdc00 &&
          input.charCodeAt(i + 1) <= 0xdfff
        ) {
          // low surrogate
          pairs.push(
            (input.charCodeAt(i) - 0xd800) * 0x400 +
              (input.charCodeAt(i + 1) - 0xdc00) +
              0x10000,
          );
        }
      } else if (input.charCodeAt(i) < 0xd800 || input.charCodeAt(i) > 0xdfff) {
        // modifiers and joiners
        pairs.push(input.charCodeAt(i));
      }
    }

    return pairs.map((char) => char.toString(16)).join("-");
  }

  return "";
}
