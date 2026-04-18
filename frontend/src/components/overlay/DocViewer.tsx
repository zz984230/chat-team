import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUiStore } from '../../stores/uiStore';
import { api } from '../../services/api';

export interface DiscussionTurn {
  round: number;
  content: string;
}

export interface AgentDiscussion {
  id: string;
  turns: DiscussionTurn[];
}

export interface ParsedDiscussion {
  requirement: string;
  agents: AgentDiscussion[];
}

export function parseDiscussion(markdown: string): ParsedDiscussion {
  const reqMatch = markdown.match(/## 原始需求\n([\s\S]*?)(?=\n## )/);
  const requirement = reqMatch ? reqMatch[1].trim() : '';

  const turnRegex = /## (.+?)（第(\d+)轮）\n([\s\S]*?)(?=\n## |$)/g;
  const agentMap = new Map<string, DiscussionTurn[]>();
  let match: RegExpExecArray | null;

  while ((match = turnRegex.exec(markdown)) !== null) {
    const agentId = match[1];
    const round = parseInt(match[2], 10);
    const content = match[3].trim();
    const turns = agentMap.get(agentId) ?? [];
    turns.push({ round, content });
    agentMap.set(agentId, turns);
  }

  const agents: AgentDiscussion[] = [];
  for (const [id, turns] of agentMap) {
    turns.sort((a, b) => a.round - b.round);
    agents.push({ id, turns });
  }

  return { requirement, agents };
}

const AGENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  analyst: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  architect: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  'dev-lead': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  'test-lead': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' };

export function DiscussionCards({ data }: { data: ParsedDiscussion }) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-500 mb-1">原始需求</h3>
        <p className="text-gray-900">{data.requirement}</p>
      </div>

      {data.agents.map((agent) => {
        const colors = AGENT_COLORS[agent.id] ?? DEFAULT_COLORS;
        return (
          <div key={agent.id} className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
            <div className={`px-4 py-2 font-semibold ${colors.text} border-b ${colors.border}`}>
              {agent.id}
              <span className="ml-2 text-xs opacity-60">{agent.turns.length} 轮发言</span>
            </div>
            <div className="p-4 space-y-4">
              {agent.turns.map((turn) => (
                <div key={turn.round}>
                  <span className={`text-xs font-medium ${colors.text} opacity-70`}>第{turn.round}轮</span>
                  <div className="mt-1 prose prose-sm max-w-none">
                    <ReactMarkdown>{turn.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DocViewer() {
  const target = useUiStore((s) => s.docViewer);
  const close = useUiStore((s) => s.closeDocViewer);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!target) {
      setContent(null);
      return;
    }
    setLoading(true);
    api.getOutputFile(target.sessionId, target.filename)
      .then((data) => setContent(data.content))
      .catch(() => setContent('加载失败'))
      .finally(() => setLoading(false));
  }, [target]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white rounded-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-gray-900 font-semibold">{target.filename}</h3>
          <button className="text-gray-400 hover:text-gray-900 text-xl" onClick={close}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 prose prose-sm max-w-none">
          {loading ? (
            <p className="text-gray-400">加载中...</p>
          ) : (
            <ReactMarkdown>{content ?? ''}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}
