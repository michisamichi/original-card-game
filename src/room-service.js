// Trusted Node authority wrapper.
import {randomBytes,randomInt} from 'node:crypto';
import {createRoomCore} from './room-core.js';
export {ROOM_PROTOCOL} from './room-core.js';
export const newRoomCode=()=>randomBytes(6).toString('hex');
export const newSeatToken=()=>randomBytes(32).toString('hex');
export const newRequestId=()=>randomBytes(16).toString('hex');
export const createRoomService=(options={})=>createRoomCore({...options,randomInt});
