import { parseJobDescription } from '../utils/parseJobDescription'

export default function JobDescriptionView({ text }: { text: string }) {
  const blocks = parseJobDescription(text)

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <h4 key={i} className="pt-1 text-sm font-bold text-ink first:pt-0 dark:text-white">
              {block.text}
            </h4>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-indigo-400">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{block.text}</p>
      })}
    </div>
  )
}
