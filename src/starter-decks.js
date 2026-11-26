// Initial nine class themes. Recipes include validated declarative class cards.
// Class names are provisional; class restrictions and hero powers are not yet rules.
import {CATALOG,validateDeck} from './cards.js';
const recipes=[
 ['warrior','ウォリアー','挑発・盤面維持','scout guard wolf warrior_vanguard knight golem warrior_ironmarshal wisp archer warrior_bannerguard beast titan spark warrior_retaliation ward'],
 ['shaman','シャーマン','登場効果・精霊','scout guard wolf shaman_gale golem dragon wisp shaman_totemcaller shaman_thunderstorm spark bolt sage flame shaman_earthmender ember'],
 ['rogue','ローグ','低コスト・速攻','scout wolf runner rogue_alley_duelist dragon wisp rogue_duskblade beast spark rogue_precise_cut draw sage flame rogue_smoke_repel echo'],
 ['paladin','パラディン','守護・回復','scout guard paladin_dawn_squire knight golem dragon wisp archer sentinel paladin_aegis_guard heal paladin_sanctuary_medic sage ward paladin_oath_blessing'],
 ['hunter','ハンター','速攻・罠','scout wolf runner hunter_ridge_marksman hunter_dune_pouncer hunter_ashfang_cub archer beast spark bolt flame ember thorn rune hunter_scatter_snare'],
 ['druid','ドルイド','大型ミニオン・展開','scout guard wolf knight druid_ancient_bastion dragon wisp druid_grove_call sentinel beast titan draw heal sage druid_deep_roots'],
 ['warlock','ウォーロック','死亡効果・手札補充','scout guard wolf warlock_hollow_vessel knight warlock_soul_pact wisp warlock_ash_scribe warlock_blood_wraith draw bolt sage flame healer ember'],
 ['mage','メイジ','呪文・ダメージ','scout guard mage_astral_apprentice mage_crimson_comet golem mage_frost_tempest wisp archer spark bolt draw sage flame rune echo'],
 ['priest','プリースト','回復・守り','scout guard knight priest_sanctuary_guard priest_dawn_wave wisp priest_mender sentinel titan heal draw sage healer priest_blessing echo']
];
export const STARTER_DECKS=Object.freeze(recipes.map(([classId,className,theme,ids])=>{
 const cards=Object.freeze(ids.split(' ').flatMap(id=>[id,id]));
 validateDeck(cards,{catalog:CATALOG});
 return Object.freeze({id:`starter_${classId}`,classId,className,theme,name:`${className} 初期デッキ`,cards});
}));
