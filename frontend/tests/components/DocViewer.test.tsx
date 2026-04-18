import { describe, it, expect } from 'vitest';
import { parseDiscussion } from '../../src/components/overlay/DocViewer';

describe('parseDiscussion', () => {
  it('extracts requirement and groups turns by agent', () => {
    const markdown = [
      '# 讨论记录\n',
      '## 原始需求\n用户要做一个聊天系统\n',
      '## analyst（第1轮）\n需要先分析用户群体\n',
      '## architect（第1轮）\n建议用 WebSocket\n',
      '## analyst（第2轮）\n补充：还要考虑移动端\n',
    ].join('\n');

    const result = parseDiscussion(markdown);

    expect(result.requirement).toBe('用户要做一个聊天系统');
    expect(result.agents).toEqual([
      {
        id: 'analyst',
        turns: [
          { round: 1, content: '需要先分析用户群体' },
          { round: 2, content: '补充：还要考虑移动端' },
        ],
      },
      {
        id: 'architect',
        turns: [
          { round: 1, content: '建议用 WebSocket' },
        ],
      },
    ]);
  });

  it('returns empty agents for non-discussion markdown', () => {
    const result = parseDiscussion('## Some Title\n\nHello');
    expect(result.requirement).toBe('');
    expect(result.agents).toEqual([]);
  });
});
