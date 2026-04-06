// Check if this is a pile/group page rather than an individual card
const isPilePage = !wikitext.startsWith('{{Infobox Card');
if (isPilePage) {
  console.log(`[DEBUG] "${cardName}" appears to be a pile page — extracting card list`);
  const listMatch = wikitext.match(/==\s*List of [^=]+==\s*([\s\S]+?)(?=\n==|$)/i);
  if (listMatch) {
    const subCards = [...listMatch[1].matchAll(/\*\s*\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]|\*\s*([^\n]+)/g)]
      .map(m => (m[1] || m[2]).trim())
      .filter(Boolean);
    console.log(`[DEBUG] Found pile cards:`, subCards);
    const results = [];
    for (const subCard of subCards) {
      const card = await fetchCard(subCard);
      if (card) results.push(card);
    }
    return results;
  }
  console.error(`[ERROR] Could not find card list on pile page for "${cardName}"`);
  return null;
}
