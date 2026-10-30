import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeBookshopWithdrawal} from '../../src/world/batianWithdrawalRules.js';
test('an eighteen-soldier sortie recalls at six casualties, before the old eleven-casualty threshold',()=>{
 const state={assigned:18,energy:75,wingNodes:2,heat:10};
 assert.equal(judgeBookshopWithdrawal({...state,lost:5}),null);
 assert.equal(judgeBookshopWithdrawal({...state,lost:6}),'ground-force-losses');
 assert.equal(judgeBookshopWithdrawal({...state,lost:0,energy:10}),'energy');
});
