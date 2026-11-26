// Initial nine class themes. Recipes deliberately use the existing catalog only.
// Class names are provisional; class restrictions and hero powers are not yet rules.
import {CATALOG,validateDeck} from './cards.js';
const recipes=[
 ['warrior','ウォリアー','挑発・盤面維持','scout guard wolf runner knight golem dragon wisp archer sentinel beast titan spark bolt ward'],
 ['shaman','シャーマン','登場効果・精霊','scout guard wolf knight golem dragon wisp archer beast spark bolt sage flame healer ember'],
 ['rogue','ローグ','低コスト・速攻','scout wolf runner knight dragon wisp archer beast spark bolt draw sage flame thorn echo'],
 ['paladin','パラディン','守護・回復','scout guard runner knight golem dragon wisp archer sentinel beast heal healer sage ward rune'],
 ['hunter','ハンター','速攻・罠','scout wolf runner knight dragon wisp archer beast spark bolt flame ember thorn rune ward'],
 ['druid','ドルイド','大型ミニオン・展開','scout guard wolf knight golem dragon wisp archer sentinel beast titan draw heal sage ember'],
 ['warlock','ウォーロック','死亡効果・手札補充','scout guard wolf runner knight dragon wisp archer beast draw bolt sage flame healer ember'],
 ['mage','メイジ','呪文・ダメージ','scout guard wolf knight golem dragon wisp archer spark bolt draw sage flame rune echo'],
 ['priest','プリースト','回復・守り','scout guard knight golem dragon wisp archer sentinel titan heal draw sage healer ward echo']
];
export const STARTER_DECKS=Object.freeze(recipes.map(([classId,className,theme,ids])=>{
 const cards=Object.freeze(ids.split(' ').flatMap(id=>[id,id]));
 validateDeck(cards,{catalog:CATALOG});
 return Object.freeze({id:`starter_${classId}`,classId,className,theme,name:`${className} 初期デッキ`,cards});
}));
