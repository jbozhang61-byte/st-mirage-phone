/**
 * 攻略情报：给 AI 看的一览表——每个人的攻略难度、攻略力、我够不够。
 * 纯数据拼装，正文注入和手机里的 AI 助手都用这一份。
 */
import { getCast, getFeed } from './store.js';
import { userName } from './st.js';
import { difficultyOf, canTake } from './difficulty.js';
import { powerOf } from './power.js';

const MAX_PEOPLE = 10;

export function powerRoster({ selfProfile = null } = {}) {
    const self = selfProfile && typeof selfProfile === 'object' ? selfProfile : {};
    const mine = powerOf({ name: userName() || '我', desc: self.personality || '', power: self.power || null });
    const hearts = getFeed('heart')?.items || [];
    const cast = getCast();
    const people = (cast.length ? cast : hearts).slice(0, MAX_PEOPLE);

    const lines = people.map(person => {
        const detail = hearts.find(item => item && item.name === person.name) || person;
        const diff = difficultyOf(detail);
        const power = powerOf(detail);
        const verdict = canTake(mine.score, detail);
        const who = diff.hit || String(diff.people || '').split(' / ')[0];
        const dims = power.rows.map(row => row.label + row.value).join('/');
        return '· ' + person.name
            + '：' + diff.label + ' ' + diff.score + '（' + who + '）'
            + '｜攻略力 ' + power.score + '（' + dims + '）'
            + '｜我 ' + mine.score + ' → ' + (verdict.ok ? '拿得下' : '还差 ' + verdict.gap);
    });

    return { mine, lines };
}
