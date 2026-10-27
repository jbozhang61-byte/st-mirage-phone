import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairJson, extractJson } from '../src/prompts.js';

test('repairJson 补全被截断的字符串', () => {
    const raw = '{"people":[{"name":"秧秧","role":"队员"},{"name":"炽霞","role":"巡';
    const json = repairJson(raw);
    assert.ok(json);
    assert.equal(json.people.length, 2);
    assert.equal(json.people[1].name, '炽霞');
});

test('extractJson 能从推理文本里救回 JSON', () => {
    const raw = '好的，我列一下：{"people":[{"name":"A"},{"name":"B';
    const json = extractJson(raw);
    assert.ok(json);
    assert.equal(json.people.length, 2);
});
