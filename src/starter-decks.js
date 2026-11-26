// Initial nine class themes. Recipes include validated declarative class cards.
// Class names are provisional; class skills are inferred from class-card IDs, with no adoption restrictions.
import {CATALOG,validateDeck} from './cards.js';
const recipes=[
 ['warrior','ウォリアー','挑発・盤面維持','scout guard wolf warrior_vanguard knight golem warrior_ironmarshal wisp archer warrior_bannerguard warrior_hammerguard warrior_veteran warrior_battlecry warrior_retaliation warrior_shieldwall'],
 ['shaman','シャーマン','登場効果・精霊','scout guard wolf shaman_gale shaman_stoneheart dragon wisp shaman_totemcaller shaman_thunderstorm shaman_stormcall bolt sage shaman_hexmist shaman_earthmender shaman_spiritgather'],
 ['rogue','ローグ','低コスト・速攻','scout rogue_venom_needle runner rogue_alley_duelist rogue_shadow_rescuer wisp rogue_duskblade beast rogue_flash_blade rogue_precise_cut draw sage flame rogue_smoke_repel rogue_mirror_escape'],
 ['paladin','パラディン','守護・回復','scout guard paladin_dawn_squire paladin_edict_of_mercy golem dragon wisp paladin_chapel_aide paladin_banner_of_unity paladin_aegis_guard paladin_luminous_seal paladin_sanctuary_medic sage ward paladin_oath_blessing'],
 ['hunter','ハンター','速攻・罠','scout wolf runner hunter_ridge_marksman hunter_dune_pouncer hunter_ashfang_cub hunter_nightstalker beast hunter_finishing_arrow bolt flame ember thorn hunter_repel_snare hunter_scatter_snare'],
 ['druid','ドルイド','大型ミニオン・展開','scout guard wolf druid_forest_blessing druid_ancient_bastion dragon wisp druid_grove_call sentinel druid_woodland_oracle titan draw druid_giant_awakening sage druid_deep_roots'],
 ['warlock','ウォーロック','死亡効果・手札補充','scout guard wolf warlock_hollow_vessel knight warlock_soul_pact warlock_abyss_imp warlock_ash_scribe warlock_blood_wraith warlock_dusk_ritual bolt warlock_grave_archivist warlock_ruin_brand healer ember'],
 ['mage','メイジ','呪文・ダメージ','scout guard mage_astral_apprentice mage_crimson_comet golem mage_frost_tempest wisp mage_archive_sprite spark mage_siphon_ray draw sage flame mage_lantern_hex echo'],
 ['priest','プリースト','回復・守り','scout guard knight priest_sanctuary_guard priest_dawn_wave wisp priest_mender sentinel priest_lightwarden priest_purify draw sage priest_last_light priest_blessing priest_recall']
];
export const STARTER_DECKS=Object.freeze(recipes.map(([classId,className,theme,ids])=>{
 const cards=Object.freeze(ids.split(' ').flatMap(id=>[id,id]));
 validateDeck(cards,{catalog:CATALOG});
 return Object.freeze({id:`starter_${classId}`,classId,className,theme,name:`${className} 初期デッキ`,cards});
}));
