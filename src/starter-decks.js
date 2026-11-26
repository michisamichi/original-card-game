// Initial nine class themes. Recipes include validated declarative class cards.
// Class names are provisional; class skills and adoption use an explicit or inferred class.
import {CATALOG,validateDeck} from './cards.js';
const recipes=[
 ['warrior','ウォリアー','挑発・盤面維持','scout guard wolf warrior_vanguard knight golem warrior_ironmarshal warrior_bulwark warrior_siege warrior_bannerguard warrior_hammerguard warrior_veteran warrior_battlecry warrior_retaliation warrior_shieldwall'],
 ['shaman','シャーマン','登場効果・精霊','shaman_cinderling guard shaman_tempestfang shaman_gale shaman_stoneheart shaman_ancientmonolith wisp shaman_totemcaller shaman_thunderstorm shaman_stormcall shaman_chainbolt shaman_runeseer shaman_hexmist shaman_earthmender shaman_spiritgather'],
 ['rogue','ローグ','低コスト・速攻','scout rogue_venom_needle rogue_night_courier rogue_alley_duelist rogue_shadow_rescuer rogue_street_informant rogue_duskblade beast rogue_flash_blade rogue_precise_cut rogue_silent_seal rogue_contract_runner rogue_twinblade rogue_smoke_repel rogue_mirror_escape'],
 ['paladin','パラディン','守護・回復','paladin_little_watch paladin_oath_captain paladin_dawn_squire paladin_edict_of_mercy paladin_sunward_knight paladin_sunrise_champion paladin_lantern_recruit paladin_chapel_aide paladin_banner_of_unity paladin_aegis_guard paladin_luminous_seal paladin_sanctuary_medic paladin_oathkeeper paladin_sacred_watch paladin_oath_blessing'],
 ['hunter','ハンター','速攻・罠','scout hunter_venom_stinger hunter_gale_hound hunter_ridge_marksman hunter_dune_pouncer hunter_ashfang_cub hunter_nightstalker hunter_pack_pathfinder hunter_finishing_arrow bolt hunter_twilight_hunter hunter_cliff_harrier hunter_execution_snare hunter_trail_forager hunter_scatter_snare'],
 ['druid','ドルイド','大型ミニオン・展開','scout guard druid_briar_stalker druid_forest_blessing druid_ancient_bastion druid_canopy_warden druid_spring_sprout druid_grove_call druid_seed_keeper druid_woodland_oracle druid_mountain_beast druid_seasonal_wisdom druid_giant_awakening druid_stream_keeper druid_deep_roots'],
 ['warlock','ウォーロック','死亡効果・手札補充','warlock_cinder_familiar guard warlock_doom_messenger warlock_hollow_vessel warlock_void_acolyte warlock_soul_pact warlock_abyss_imp warlock_ash_scribe warlock_blood_wraith warlock_dusk_ritual warlock_grave_miasma warlock_grave_archivist warlock_ruin_brand warlock_eclipse_oracle ember'],
 ['mage','メイジ','呪文・ダメージ','mage_ember_familiar guard mage_astral_apprentice mage_crimson_comet golem mage_frost_tempest dragon mage_archive_sprite mage_cinder_pin mage_siphon_ray mage_hidden_library mage_codex_keeper mage_storm_scholar mage_lantern_hex mage_mirror_gate'],
 ['priest','プリースト','回復・守り','priest_votive priest_aegis priest_penitent priest_sanctuary_guard priest_dawn_wave priest_candlekeeper priest_mender priest_judgment priest_lightwarden priest_purify priest_scripture priest_scribe priest_last_light priest_blessing priest_recall']
];
export const STARTER_DECKS=Object.freeze(recipes.map(([classId,className,theme,ids])=>{
 const cards=Object.freeze(ids.split(' ').flatMap(id=>[id,id]));
 validateDeck(cards,{catalog:CATALOG});
 return Object.freeze({id:`starter_${classId}`,classId,className,theme,name:`${className} 初期デッキ`,cards});
}));
