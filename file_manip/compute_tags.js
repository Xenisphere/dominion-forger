function computeTags(text, types) {
  const t = text.toLowerCase();
  const tags = new Set();
  const opp_tags = new Set();
  const typeList = types.map(t => t.toLowerCase());

  const oppSections = [...t.matchAll(/(?:each other player|another player|they)[^.]*\.?/g)]
    .map(m => m[0]).join(' ');
  const selfText = t.replace(/(?:each other player|another player|they)[^.]*\./g, '');

  const isAction = typeList.some(t => t.includes('action'));

  const isTokenList = /move your.*token|your \+1 card.*\+1 action.*token|\+1 card,.*\+1 action.*token/i.test(text);
  
  if (!isTokenList) {
    if (/\+1 card(?!\s*token)/i.test(text)) tags.add('+card');
    else if (/\+\d+ cards?/i.test(text)) tags.add('+cards');
    if (/\+1 action(?!\s*token)/i.test(text)) tags.add('+action');
    else if (/\+\d+ actions?/i.test(text)) tags.add('+actions');
    if (/\+\s*\(\d+\)(?!\s*token)/i.test(text)) tags.add('+coins');
    if (/\+\d+ buys?(?!\s*token)/i.test(text)) tags.add('+buys');
  }

  // CARD GIVES
  if (/\+\d+ (?:victory token|\{)/i.test(selfText)) tags.add('+vp_tokens');
  if (/\+\d+ villagers?/i.test(selfText)) tags.add('+villagers');
  if (/\+\d+ coffers?/i.test(selfText)) tags.add('+coffers');
  if (/\+\d+ favors?/i.test(selfText)) tags.add('+favors');
  
  /*
    if (/\+1 card/i.test(text)) tags.add('+card');
    else if (/\+\d+ cards/i.test(text)) tags.add('+cards');
    if (/\+1 action/i.test(text)) tags.add('+action');
    else if (/\+\d+ actions/i.test(text)) tags.add('+actions');
    if (/\+\s*\(\d+\)/i.test(text)) tags.add('+coins');
    if (/\+\d+ buys?/i.test(text)) tags.add('+buys');
  */
  
  // COST
  if (/cost.*less|costs? \(?[0-9]+\)? less|reduce.*cost/i.test(t)) tags.add('cost_reduction');
  if (/overpay|pay extra/i.test(selfText))  tags.add('overpay');
  if (/\[1\]/.test(text)) tags.add('potion');
  if (/<\d+>/.test(text)) tags.add('debt');

  // CARD MOVEMENT (self)
  if (/gain a|gain an|gain up to|gains a|gain.*card/i.test(selfText) && !/other player gains/i.test(selfText)) tags.add('gain');
  if (/onto your deck|top of your deck|put.*on top/i.test(selfText))  tags.add('topdeck');
  if (/discard(?! pile| them afterwards)/i.test(selfText)) tags.add('discard');
  if (/set (it |this |them )?aside/i.test(selfText)) tags.add('set_aside');
  if (/\btrash(es)?\b/i.test(selfText)) tags.add('trash');
  if (/exchange/i.test(selfText)) tags.add('exchange');
  if (/\bexile\b/i.test(selfText)) tags.add('exile');

  // CARD MOVEMENT (opponent)
  if (/each player.*reveal|reveal.*each player|including you/i.test(t)) opp_tags.add('reveal');
  if (/each other player draws|another player draws/i.test(oppSections)) opp_tags.add('draw');
  if (/look at the top|top \d+ cards of their deck/i.test(oppSections)) opp_tags.add('scry');
  if (/onto their deck|top of their deck/i.test(oppSections)) opp_tags.add('topdeck');
  if (/\btrash(es)?\b/i.test(oppSections)) opp_tags.add('trash');
  if (/gain a|gain an/i.test(oppSections)) opp_tags.add('gain');
  if (/discard/i.test(oppSections)) opp_tags.add('discard');

  // SELF REVEAL (only if selfText contains reveal, not just oppSections)
  if (/reveal/i.test(selfText) && !/each other player|another player/i.test(selfText)) tags.add('reveal');

  // TRIGGERS
  if (/each of your turns|at the start of each/i.test(selfText)) tags.add('each_turn');
  if (/when another player plays an attack/i.test(t)) tags.add('reaction_attack');
  if (typeList.some(t => t.includes('duration'))) tags.add('duration');
  if (/when you discard/i.test(selfText))  tags.add('on_discard');
  if (/when you trash/i.test(selfText)) tags.add('on_trash');
  if (/when you gain/i.test(selfText)) tags.add('on_gain');
  if (/when you buy/i.test(selfText)) tags.add('on_buy');

  // ATTACKS
  if (/each other player|another player|each player|any other player/i.test(t) && typeList.some(t => t.includes('attack'))) tags.add('attack');
  if (/\btrash(es)?\b/i.test(oppSections) && typeList.some(t => t.includes('attack'))) tags.add('trash_attack');
  if (/top of their deck|top of (?:each )?other player/i.test(oppSections)) tags.add('deck_attack');
  if (/gains? a Curse|gains? a Ruins|gains? a Copper/i.test(oppSections)) opp_tags.add('junking');
  if (/gain.*Copper|gain.*Curse|gain.*Ruins/i.test(selfText)) tags.add('self_junk');
  if (/reveals? (?:their )?hand/i.test(oppSections))  tags.add('hand_reveal');
  if (/all players|everyone|each player/i.test(t)) tags.add('global_effect');

  // TRASHING (self)
  if (((tags.has('trash') && !/or.*trash/i.test(selfText) && !/trash.*or/i.test(selfText)) || /trash.*choose\s*:/i.test(selfText)) && (tags.has('+cards') || tags.has('+card') || tags.has('+coins') || tags.has('+action') || tags.has('+actions') || tags.has('gain') || /trash.*into your hand/i.test(selfText)) tags.add('trash_for_benefit');
  if (/trash this|return this to its pile/i.test(selfText)) tags.add('trash_self');
  if (/trash.*gain|trash.*to gain/i.test(selfText) && !/trash.*or.*gain/i.test(selfText)) tags.add('trash_to_gain');

  // GAINING (self)
  if (/gain.*to your hand|gain.*into your hand/i.test(selfText)) tags.add('gain_to_hand');
  if (/gain.*onto your deck|gain.*to your deck/i.test(selfText)) tags.add('gain_to_deck');
  if (/not in the supply|non-supply/i.test(selfText)) tags.add('gain_non_supply');

  // DECK CONTROL (self)
  if (/look at the top|reveal.*top|top \d+ cards of your deck|reveal.*until/i.test(selfText)) tags.add('scry');
  if (/search your deck|look through your deck/i.test(selfText)) tags.add('search_deck');
  if (/reorder|in any order|rearrange/i.test(selfText)) tags.add('reorder');

  // SPECIAL RESOURCES
  if (/\bhorse\b/i.test(t)) tags.add('uses_horses');
  if (/\bboon\b/i.test(t)) tags.add('uses_boons');
  if (/spoils/i.test(t)) tags.add('uses_spoils');
  if (/\bloot\b/i.test(t)) tags.add('uses_loot');
  if (/\bhex\b/i.test(t)) tags.add('uses_hexes');

  // RULE MODIFIERS
  if (/take an extra turn|extra turn/i.test(selfText)) tags.add('extra_turn');
  //if (/each of your turns/i.test(selfText)) tags.add('extra_buy_phase');

  // REACTIONS
  if (/when.*trash/i.test(t) && typeList.some(t => t.includes('reaction'))) tags.add('reaction_trash');
  if (/when.*gain/i.test(t) && typeList.some(t => t.includes('reaction')))  tags.add('reaction_gain');

  // RESERVE
  if (/tavern mat|call.*from.*tavern/i.test(t) || typeList.some(t => t.includes('reserve'))) tags.add('tavern_mat');

  // DERIVED
  const hasActions = tags.has('+actions');
  const hasAction  = tags.has('+action');
  const hasAnyAction = hasAction || hasActions;
  const hasCards = tags.has('+cards');
  const hasCard  = tags.has('+card');
  const hasAnyDraw = hasCard || hasCards || /draw until|reveal.*put.*into your hand/i.test(selfText);
  
  if (/move your \+1 action token/i.test(text)) tags.add('engine_piece');
  if (/move your \+1 card token/i.test(text)) tags.add('engine_piece');
  if (/move your.*\+\(\d+\) token/i.test(text)) { tags.add('+coins'); tags.add('payload_piece'); }
  if (/move your \+1 buy token/i.test(text)) { tags.add('+buys'); tags.add('payload_piece'); }
  if (isAction && !hasAnyAction && !/play.*action.*twice|play.*twice|play it/i.test(selfText)) tags.add('terminal');
  else if (/\bplay\b.*action|\bplay\b.*it/i.test(selfText) && !/from\s+play\b/i.test(selfText)) tags.add('plays_actions');
  if (hasActions && /\+[2-9] actions?/i.test(text)) tags.add('village');
  if (/draw/i.test(selfText)) tags.add('draw');

  // CLEANUP
  if (tags.has('attack') && (opp_tags.has('discard') || (tags.has('discard') && tags.has('global_effect')))) {
    opp_tags.delete('discard');
    tags.delete('discard');
    tags.delete('attack');
    tags.add('discard_attack');
  }
  if (tags.has('+action') && tags.has('+card')) {
    tags.delete('+action');
    tags.delete('+card');
    tags.add('cantrip');
  }
  if (tags.has('village')) {
    tags.delete('+actions');
    tags.delete('cantrip');
  }
  if (tags.has('+action') && tags.has('+card')) {
    tags.delete('+action');
    tags.delete('+card');
    tags.add('cantrip');
  }
  if (tags.has('village')) {
    tags.delete('+actions');
    tags.delete('cantrip');
  }
  if (tags.has('reaction_attack')) tags.delete('on_attack');

  
  if (tags.has('discard_attack') || tags.has('trash_attack') || tags.has('deck_attack')) tags.add('attack');

  // FALLBACK
  if (tags.size === 0) tags.add('utility');

  //Sort tags
  return { tags: [...tags].sort(), opponent_tags: [...opp_tags].sort() };

  return { tags: [...tags], opponent_tags: [...opp_tags] };
}

module.exports = computeTags;
