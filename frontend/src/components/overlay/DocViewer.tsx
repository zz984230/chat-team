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
