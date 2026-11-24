// Declarative recipes: shared by spells, minions and secrets. No executable scripts.
const friendly=['friendlyChoice','friendlyMinions','friendlyRandom','sourceMinion'];
const enemy=['enemyMinionChoice','enemyMinions','enemyRandom','eventMinion'];
export const GRANT_KEYWORDS=Object.freeze({grantTaunt:'taunt',grantShield:'divineShield',grantCharge:'charge',grantRush:'rush',grantWindfury:'windfury',grantLifesteal:'lifesteal',grantPoisonous:'poisonous',grantStealth:'stealth',grantSpellDamage:'spellDamage'});
export const MANA_OPERATIONS=Object.freeze(['gainMana','restoreMana','reduceMana']);
export const isManaOperation=op=>MANA_OPERATIONS.includes(op);
const targets=Object.freeze({gainMana:['self'],restoreMana:['self'],reduceMana:['enemyHero'],...Object.fromEntries(Object.keys(GRANT_KEYWORDS).map(op=>[op,friendly])),discountHand:['ownHandRandom','ownHandAll'],surchargeHand:['enemyHandRandom','enemyHandAll'],silence:[...friendly,...enemy],setAttack:[...friendly,...enemy],setHealth:[...friendly,...enemy],transformWisp:[...friendly,...enemy],transformScout:[...friendly,...enemy],transformGuard:[...friendly,...enemy],reviveLast:['graveMinion'],reviveRandom:['graveMinion'],summonHand:['handMinion'],summonDeck:['deckMinion'],recoverGrave:['graveMinion','graveSpell'],fetchDeck:['deckMinion','deckSpell'],discardHand:['ownHand'],returnHand:[...friendly,...enemy],summonFixed:['tokenWisp','tokenScout','tokenGuard'],summonRandom:['poolMinion'],generateFixed:['tokenWisp','tokenScout','tokenGuard','tokenSpark'],generateRandom:['poolMinion','poolSpell'],draw:['self'],heal:['self',...friendly],damage:['enemyChoice',...enemy,'enemyHero','enemyCharacters'],destroy:enemy,buffAttack:friendly,buffHealth:friendly,buffBoth:friendly,tempAttack:friendly,weakenAttack:enemy,weakenHealth:enemy,weakenBoth:enemy});
const secretWhen=Object.freeze(['heroAttack','attack','minionPlayed','spellPlayed']);
export const TIMINGS=Object.freeze({minion:Object.freeze(['none','summon','death','turnStart','turnEnd']),spell:Object.freeze(['play']),secret:secretWhen});
export const TIMING_LABELS=Object.freeze({none:'効果なし',summon:'登場時',death:'死亡時',turnStart:'自分のターン開始時',turnEnd:'自分のターン終了時',play:'使用時',heroAttack:'自分のプレイヤーが攻撃される前',attack:'相手ミニオンが攻撃する前',minionPlayed:'相手がミニオンを使用した後',spellPlayed:'相手がスペルを使用した後'});
export const OPERATION_LABELS=Object.freeze({gainMana:'最大マナと現在マナを増加',restoreMana:'現在マナを回復',reduceMana:'相手の最大マナを減少',grantCharge:'速攻付与',grantRush:'急襲付与',grantWindfury:'疾風付与',grantLifesteal:'生命奪取付与',grantPoisonous:'猛毒付与',grantStealth:'潜伏付与',grantSpellDamage:'呪文ダメージ＋1付与',discountHand:'手札のマナコスト減少',surchargeHand:'相手手札のマナコスト増加',silence:'沈黙（効果・能力・強化解除）',setAttack:'攻撃力を指定値に変更',setHealth:'体力を指定値に変更',transformWisp:'灯火の精霊に変身',transformScout:'風の斥候に変身',transformGuard:'盾の衛兵に変身',reviveLast:'墓地の直近ミニオンを蘇生',reviveRandom:'墓地からランダム蘇生',summonHand:'手札からランダム特殊召喚',summonDeck:'山札からランダム特殊召喚',recoverGrave:'墓地からランダムに回収',fetchDeck:'山札からランダムに手札へ',discardHand:'手札をランダムに破棄',returnHand:'手札に戻す',summonFixed:'指定ミニオンを特殊召喚',summonRandom:'ランダム特殊召喚',generateFixed:'指定カードを手札に生成',generateRandom:'ランダムカードを手札に生成',draw:'ドロー',heal:'回復',damage:'ダメージ',destroy:'直接破壊',grantTaunt:'挑発付与',grantShield:'聖なる盾付与',buffAttack:'攻撃力強化',buffHealth:'体力強化',buffBoth:'攻撃力・体力強化',tempAttack:'一時的な攻撃力強化',weakenAttack:'攻撃力弱体化',weakenHealth:'体力弱体化',weakenBoth:'攻撃力・体力弱体化'});
export const TARGET_LABELS=Object.freeze({ownHandRandom:'自分の手札1枚（ランダム）',ownHandAll:'自分の手札すべて',enemyHandRandom:'相手の手札1枚（ランダム）',enemyHandAll:'相手の手札すべて',graveMinion:'自分の墓地のミニオン',graveSpell:'自分の墓地のスペル',handMinion:'自分の手札のミニオン',deckMinion:'自分の山札のミニオン',deckSpell:'自分の山札のスペル',ownHand:'自分の手札',tokenWisp:'灯火の精霊（1/2）',tokenScout:'風の斥候（2/1）',tokenGuard:'盾の衛兵（1/3・挑発）',tokenSpark:'閃光弾',poolMinion:'基本ミニオン',poolSpell:'基本スペル',self:'自分のプレイヤー',enemyChoice:'相手のプレイヤーまたはミニオン（選択）',enemyMinionChoice:'相手のミニオン1体（選択）',enemyMinions:'相手の全ミニオン',eventMinion:'発動条件のミニオン',friendlyChoice:'味方ミニオン1体（選択）',friendlyMinions:'味方の全ミニオン',friendlyRandom:'ランダムな味方ミニオン1体',enemyRandom:'ランダムな相手ミニオン1体',enemyHero:'相手プレイヤー',enemyCharacters:'相手プレイヤーと全ミニオン',sourceMinion:'このミニオン'});
export const isRandomTarget=t=>t==='friendlyRandom'||t==='enemyRandom';
export const isChoiceTarget=t=>['enemyChoice','enemyMinionChoice','friendlyChoice'].includes(t);
// Precompute the finite set of recipes once. Public callers receive independent arrays.
const timings=[...new Set(Object.values(TIMINGS).flat())];
const targetIndex=new Map(),followTargetIndex=new Map();
for(const when of timings){const byOp=new Map(),followByOp=new Map();for(const [operation,options] of Object.entries(targets)){
 const list=when==='none'?[]:options.filter(t=>!(isChoiceTarget(t)&&(['death','turnStart','turnEnd'].includes(when)||secretWhen.includes(when)))&&!(t==='sourceMinion'&&!['summon','turnStart','turnEnd'].includes(when))&&!(t==='eventMinion'&&!['attack','heroAttack','minionPlayed'].includes(when)));
 byOp.set(operation,list);followByOp.set(operation,list.filter(t=>!isChoiceTarget(t)&&t!=='eventMinion'));
 }targetIndex.set(when,byOp);followTargetIndex.set(when,followByOp);
}
const optionsFor=(index,when,op)=>index.get(when)?.get(op)??[];
export function allowedTargets(when,operation){return [...optionsFor(targetIndex,when,operation)];}
// Fixed thresholds keep recipes backward compatible and evaluation bounded.
// All conditions observe the state after the first step and death removal.
const followRules=Object.freeze({
 always:['続けて実行',()=>true],
 killed:['最初の効果でミニオンを倒した場合',(_p,_e,killed)=>killed],
 notKilled:['最初の効果でミニオンを倒さなかった場合',(_p,_e,killed)=>!killed],
 lowHP:['最初の効果の後、自分のHPが15以下の場合',p=>p.hp<=15],
 outnumbered:['最初の効果の後、相手の場のミニオンが自分より多い場合',(p,e)=>e.board.length>p.board.length],
 lowHand:['最初の効果の後、自分の手札が2枚以下の場合',p=>p.hand.length<=2],
 highHand:['最初の効果の後、自分の手札が5枚以上の場合',p=>p.hand.length>=5],
 emptyBoard:['最初の効果の後、自分の場にミニオンがいない場合',p=>p.board.length===0],
 wideBoard:['最初の効果の後、自分の場にミニオンが3体以上いる場合',p=>p.board.length>=3],
 emptyMana:['最初の効果の後、自分の現在マナが0の場合',p=>p.mana===0],
 spareMana:['最初の効果の後、自分の現在マナが3以上の場合',p=>p.mana>=3],
 enemyLowHP:['最初の効果の後、相手のHPが15以下の場合',(_p,e)=>e.hp<=15],
 lowDeck:['最初の効果の後、自分の山札が5枚以下の場合',p=>p.deck.length<=5],
 enemyEmptyBoard:['最初の効果の後、相手の場にミニオンがいない場合',(_p,e)=>e.board.length===0],
 outnumbers:['最初の効果の後、自分の場のミニオンが相手より多い場合',(p,e)=>p.board.length>e.board.length],
 enemyLowHand:['最初の効果の後、相手の手札が2枚以下の場合',(_p,e)=>e.hand.length<=2],
 enemyLowDeck:['最初の効果の後、相手の山札が5枚以下の場合',(_p,e)=>e.deck.length<=5],
 highMaxMana:['最初の効果の後、自分の最大マナが7以上の場合',p=>p.maxMana>=7],
 handAdvantage:['最初の効果の後、自分の手札が相手より多い場合',(p,e)=>p.hand.length>e.hand.length],
 handDisadvantage:['最初の効果の後、自分の手札が相手より少ない場合',(p,e)=>p.hand.length<e.hand.length],
 hpDisadvantage:['最初の効果の後、自分のHPが相手より少ない場合',(p,e)=>p.hp<e.hp],
 enemyWideBoard:['最初の効果の後、相手の場にミニオンが3体以上いる場合',(_p,e)=>e.board.length>=3],
 fullMaxMana:['最初の効果の後、自分の最大マナが10の場合',p=>p.maxMana===10]
});
export const FOLLOW_CONDITIONS=Object.freeze(Object.fromEntries(Object.entries(followRules).map(([id,[label]])=>[id,label])));
export function matchesFollowCondition(condition,own,enemy,killed){
 if(typeof condition!=='string'||!Object.hasOwn(followRules,condition))throw Error('追加効果条件不正');
 return followRules[condition][1](own,enemy,killed);
}
export function allowedFollowTargets(when,operation){return [...optionsFor(followTargetIndex,when,operation)];}
function exactKeys(o,keys){return !!o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
export const canKill=operation=>operation==='damage'||operation==='destroy';
export const followConditions=op=>Object.keys(FOLLOW_CONDITIONS).filter(c=>!['killed','notKilled'].includes(c)||canKill(op));
export const isCostChange=operation=>['discountHand','surchargeHand'].includes(operation);
export const TRANSFORM_FORMS=Object.freeze({transformWisp:'wisp',transformScout:'scout',transformGuard:'guard'});
export const fixedAmount=operation=>Object.hasOwn(TRANSFORM_FORMS,operation)||Object.hasOwn(GRANT_KEYWORDS,operation)||['silence','destroy','returnHand'].includes(operation);
export const isCreation=operation=>['summonFixed','summonRandom','generateFixed','generateRandom'].includes(operation);
export const isZoneMove=operation=>['reviveLast','reviveRandom','summonHand','summonDeck','recoverGrave','fetchDeck','discardHand'].includes(operation);
export const amountMax=operation=>(isCostChange(operation)||isManaOperation(operation))?10:isCreation(operation)||isZoneMove(operation)?3:30;
function amountValid(n,operation){return Number.isInteger(n)&&n>=1&&n<=amountMax(operation)&&(!fixedAmount(operation)||n===1);}
export function validateAbility(a,when){
 const keys=['when','operation','target','amount'];
 if(a&&Object.hasOwn(a,'followUp'))keys.push('followUp');
 if(!exactKeys(a,keys)||a.when!==when||!optionsFor(targetIndex,when,a.operation).includes(a.target)||!amountValid(a.amount,a.operation))throw Error('効果定義不正');
 if(Object.hasOwn(a,'followUp')){const f=a.followUp;if(!exactKeys(f,['condition','operation','target','amount'])||typeof f.condition!=='string'||!Object.hasOwn(FOLLOW_CONDITIONS,f.condition)||(!canKill(a.operation)&&['killed','notKilled'].includes(f.condition))||!optionsFor(followTargetIndex,when,f.operation).includes(f.target)||!amountValid(f.amount,f.operation))throw Error('追加効果定義不正');}
 return true;
}
function effectBody(a){
 if(isManaOperation(a.operation))return ({gainMana:`自分の最大マナと現在マナを最大${a.amount}増加（上限10）`,restoreMana:`自分の現在マナを${a.amount}回復`,reduceMana:`相手の最大マナを${a.amount}減少（現在マナも上限内に調整）`})[a.operation];
 if(isCostChange(a.operation))return `${TARGET_LABELS[a.target]}のマナコストを${a.amount}${a.operation==='discountHand'?'減少':'増加'}`;
 if(isZoneMove(a.operation)){const subject=TARGET_LABELS[a.target],n=a.amount;return ({reviveLast:`${subject}を新しい順に${n}体蘇生`,reviveRandom:`${subject}をランダムに${n}体蘇生`,summonHand:`${subject}をランダムに${n}体特殊召喚`,summonDeck:`${subject}をランダムに${n}体特殊召喚`,recoverGrave:`${subject}をランダムに${n}枚手札に戻す`,fetchDeck:`${subject}をランダムに${n}枚手札に加える`,discardHand:`${subject}をランダムに${n}枚破棄`})[a.operation];}

 if(isCreation(a.operation))return `${a.operation.endsWith('Random')?'ランダムな':''}${TARGET_LABELS[a.target]}を${a.amount}${a.operation.startsWith('summon')?'体特殊召喚':'枚手札に生成'}`;
 const subject={self:'自分のHP',enemyChoice:'相手のミニオンまたはプレイヤー',enemyMinionChoice:'相手のミニオン1体',enemyMinions:'相手の全ミニオン',eventMinion:'そのミニオン',friendlyChoice:'味方ミニオン1体',friendlyMinions:'味方の全ミニオン',friendlyRandom:'ランダムな味方ミニオン1体',enemyRandom:'ランダムな相手ミニオン1体',enemyHero:'相手プレイヤー',enemyCharacters:'相手プレイヤーと全ミニオン',sourceMinion:'このミニオン'}[a.target];
 const body=a.operation==='draw'?`カードを${a.amount}枚引く`:a.operation==='heal'?`${subject}を${a.amount}回復`:a.operation==='damage'?`${subject}に${a.amount}ダメージ`:a.operation==='silence'?`${subject}を沈黙させる`:Object.hasOwn(TRANSFORM_FORMS,a.operation)?`${subject}を${OPERATION_LABELS[a.operation]}`:a.operation==='setAttack'?`${subject}の攻撃力を${a.amount}に設定`:a.operation==='setHealth'?`${subject}の最大・現在体力を${a.amount}に設定`:a.operation==='destroy'?`${subject}を破壊`:a.operation==='returnHand'?`${subject}を持ち主の手札に戻す（空き枠のみ）`:Object.hasOwn(GRANT_KEYWORDS,a.operation)?`${subject}に${OPERATION_LABELS[a.operation].replace('付与','')}を付与`:a.operation==='tempAttack'?`${subject}の攻撃力を現在のターン終了まで${a.amount}強化`:`${subject}の${{buffAttack:'攻撃力',buffHealth:'最大・現在体力',buffBoth:'攻撃力・最大体力・現在体力',weakenAttack:'攻撃力',weakenHealth:'最大・現在体力',weakenBoth:'攻撃力・最大体力・現在体力'}[a.operation]}を${a.amount}${a.operation.startsWith('weaken')?'弱体化':'強化'}`;
 return body;
}
export function abilityText(a){
 const body=effectBody(a)+(a.followUp?`。${a.followUp.condition==='always'?'続けて、':FOLLOW_CONDITIONS[a.followUp.condition]+'、'}${effectBody(a.followUp)}`:'');
 return secretWhen.includes(a.when)?`秘策：${TIMING_LABELS[a.when]}、${body}`:a.when==='play'?body:`${TIMING_LABELS[a.when]}：${body}`;
}
export function executeAbility(a,{seat,target,sourceId,minions,draw,heal,damage,destroy,grantKeyword,buff,weaken,tempAttack,randomIndex,createCards,moveCards,returnHand,changeCost,silence,transform,setStat,changeMana}){
 if(isManaOperation(a.operation))return changeMana(seat,a.operation,a.amount);
 if(isCostChange(a.operation))return changeCost(seat,a.operation,a.target,a.amount);
 if(isCreation(a.operation))return createCards(seat,a.operation,a.target,a.amount);
 if(isZoneMove(a.operation))return moveCards(seat,a.operation,a.target,a.amount);
 if(a.operation==='draw'){draw(seat,a.amount);return true;}
 const owner=['self','friendlyChoice','friendlyMinions','friendlyRandom','sourceMinion'].includes(a.target)?seat:1-seat;
 let ids=['self','enemyHero'].includes(a.target)?['hero']:a.target==='enemyCharacters'?[...minions(owner),'hero']:a.target==='sourceMinion'?minions(owner).filter(id=>id===sourceId):['enemyMinions','friendlyMinions'].includes(a.target)?minions(owner):[target];
 if(isRandomTarget(a.target)){const pool=minions(owner);if(!pool.length)return false;ids=[pool[randomIndex(pool.length)]];}
 if(!ids.length)return false;
 if(a.operation==='returnHand'){let moved=false;for(const id of ids)if(returnHand(owner,id))moved=true;return moved;}
 for(const id of ids){
  if(a.operation==='heal')heal(owner,id,a.amount);
  else if(a.operation==='damage')damage(owner,id,a.amount);
  else if(a.operation==='destroy')destroy(owner,id);
  else if(a.operation==='silence')silence(owner,id);
  else if(Object.hasOwn(TRANSFORM_FORMS,a.operation))transform(owner,id,TRANSFORM_FORMS[a.operation]);
  else if(a.operation==='setAttack'||a.operation==='setHealth')setStat(owner,id,a.operation,a.amount);
  else if(Object.hasOwn(GRANT_KEYWORDS,a.operation))grantKeyword(owner,id,GRANT_KEYWORDS[a.operation]);
  else if(['buffAttack','buffHealth','buffBoth'].includes(a.operation))buff(owner,id,a.operation==='buffHealth'?0:a.amount,a.operation==='buffAttack'?0:a.amount);
  else if(a.operation==='tempAttack')tempAttack(owner,id,a.amount);
  else if(['weakenAttack','weakenHealth','weakenBoth'].includes(a.operation))weaken(owner,id,a.operation==='weakenHealth'?0:a.amount,a.operation==='weakenAttack'?0:a.amount);
  else throw Error('未対応効果');
 }
 return true;
}
