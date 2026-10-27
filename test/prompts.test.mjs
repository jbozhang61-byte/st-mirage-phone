import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseChatReply, parseLine, parseMoments, extractJson, stripFence,
    splitSpeaker, historyBlock, phoneStateSummary, personaBlock,
} from '../src/prompts.js';

const FENCE = String.fromCharCode(96, 96, 96);

test('stripFence 去掉代码围栏', () => {
    assert.equal(stripFence(FENCE + '\nhi\n' + FENCE), 'hi');
});

test('parseLine 识别普通文字', () => {
    const line = parseLine('你在干嘛');
    assert.equal(line.type, 'text');
    assert.equal(line.text, '你在干嘛');
});

test('parseLine 识别图片/语音/红包/转账/位置/表情', () => {
    assert.equal(parseLine('[图片] 窗外的雪').type, 'photo');
    const voice = parseLine('[语音] 我马上到，别急');
    assert.equal(voice.type, 'voice');
    assert.ok(voice.meta.sec >= 2);
    const packet = parseLine('[红包 ¥8.88] 冬至快乐');
    assert.equal(packet.type, 'redpacket');
    assert.equal(packet.meta.amount, 8.88);
    assert.equal(packet.text, '冬至快乐');
    const transfer = parseLine('【转账 ¥52】买奶茶');
    assert.equal(transfer.type, 'transfer');
    assert.equal(transfer.meta.amount, 52);
    assert.equal(parseLine('[位置] 老城门').type, 'location');
    assert.equal(parseLine('[表情] 😊').type, 'sticker');
});

test('parseLine 纯 emoji 当表情', () => {
    assert.equal(parseLine('🥺').type, 'sticker');
});

test('parseChatReply 单聊多行', () => {
    const raw = FENCE + '\n[图片] 窗外的雪\n在的。\n[语音] 我马上到，别急\n' + FENCE;
    const out = parseChatReply(raw, { members: ['夏之'] });
    assert.equal(out.length, 3);
    assert.deepEqual(out.map(m => m.type), ['photo', 'text', 'voice']);
});

test('parseChatReply 群聊按名字分人，续行沿用上一人', () => {
    const out = parseChatReply('夏之：你先睡\n夏之：我一会儿就回\n林晚：等等我\n还有我呢', {
        members: ['夏之', '林晚'], fallbackSender: '夏之',
    });
    assert.equal(out.length, 4);
    assert.equal(out[0].sender, '夏之');
    assert.equal(out[2].sender, '林晚');
    assert.equal(out[3].sender, '林晚');
});

test('parseChatReply [不发] 表示没有消息', () => {
    assert.equal(parseChatReply('[不发]', { members: ['A'] }).length, 0);
    assert.equal(parseChatReply('  [不发]  ', { members: ['A'] }).length, 0);
});

test('splitSpeaker 认得出名字', () => {
    assert.deepEqual(splitSpeaker('夏之：在吗', ['夏之']), { name: '夏之', body: '在吗' });
    assert.equal(splitSpeaker('你好：世界', ['夏之']).name, '');
});

test('extractJson 抠 JSON', () => {
    const json = extractJson('好的：{"posts":[{"author":"A","text":"hi"}]} 以上。');
    assert.equal(json.posts.length, 1);
});

test('parseMoments 走 JSON 并过滤不合法的作者', () => {
    const posts = parseMoments('{"posts":[{"author":"夏之","text":"今天风很大","likes":["林晚"],"comments":[{"by":"林晚","text":"记得围巾"}]}]}', { contacts: ['夏之', '林晚'] });
    assert.equal(posts.length, 1);
    assert.equal(posts[0].comments[0].by, '林晚');
});

test('historyBlock 把消息排成对话', () => {
    const text = historyBlock([
        { from: 'me', text: '在吗' },
        { from: 'them', sender: '夏之', type: 'voice', text: '嗯' },
    ], { user: '我', members: ['夏之'] });
    assert.match(text, /我：在吗/);
    assert.match(text, /夏之：\[语音\] 嗯/);
});

test('phoneStateSummary 空数据返回空串', () => {
    assert.equal(phoneStateSummary({ threads: [], user: '我' }), '');
    const text = phoneStateSummary({ threads: [{ members: ['夏之'], msgs: [{ from: 'them', sender: '夏之', type: 'text', text: '晚安' }], updated: 1 }], user: '我' });
    assert.match(text, /夏之：晚安/);
});

test('personaBlock 拼接角色卡', () => {
    const block = personaBlock('夏之', { description: '一个安静的人', personality: '温柔' });
    assert.match(block, /一个安静的人/);
    assert.match(block, /温柔/);
});
