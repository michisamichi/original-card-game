// Class identity is derived only from official class-card IDs in the initial deck.
// Mixed or neutral decks remain classless; no existing saved deck format changes.
import {CLASS_CARDS} from './class-cards.js';
export const SKILL_COST=2,ARMOR_CAP=99;
const entries=[
 ['warrior','ウォリアー','鉄壁','装甲を2獲得'],
 ['shaman','シャーマン','精霊招来','斥候・精霊・衛兵のいずれか1体をランダム召喚'],
 ['rogue','ローグ','刃の舞','味方ミニオン1体の攻撃力+2（ターン終了まで）'],
 ['paladin','パラディン','光の従者','灯火の精霊（1/2）を1体召喚'],
 ['hunter','ハンター','狙撃','相手のヒーローに2ダメージ'],
 ['druid','ドルイド','森の加護','装甲+1、味方ミニオン1体の攻撃力+1（ターン終了まで）。味方がいない場合は装甲のみ'],
 ['warlock','ウォーロック','血の契約','自分のヒーローに2ダメージ、生存時に1枚ドロー'],
 ['mage','メイジ','魔弾','相手のヒーローまたはミニオン1体に1ダメージ'],
 ['priest','プリースト','祈り','自分のヒーローまたは味方ミニオン1体を2回復']
];
export const CLASS_SKILLS=Object.freeze(Object.fromEntries(entries.map(([id,className,name,description])=>[id,Object.freeze({id,className,name,description})])));
const owners=new Map(CLASS_CARDS.map(c=>[c.id,c.id.split('_')[0]]));
export function inferClass(deck){const ids=new Set(deck.map(id=>owners.get(id)).filter(id=>Object.hasOwn(CLASS_SKILLS,id)));return ids.size===1?[...ids][0]:null;}
export function validSkillState(p){return Object.hasOwn(CLASS_SKILLS,p.classId)&&typeof p.skillUsed==='boolean'&&Number.isSafeInteger(p.armor)&&p.armor>=0&&p.armor<=ARMOR_CAP;}
