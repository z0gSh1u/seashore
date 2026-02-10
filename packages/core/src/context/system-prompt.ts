interface Example {
  input: string
  output: string
}

type OutputFormat = 'json' | 'code' | 'markdown' | 'text'

interface OutputFormatOptions {
  language?: string
}

interface SystemPromptBuilder {
  role(description: string): SystemPromptBuilder
  instruction(text: string): SystemPromptBuilder
  constraint(text: string): SystemPromptBuilder
  example(example: Example): SystemPromptBuilder
  outputFormat(format: OutputFormat, options?: OutputFormatOptions): SystemPromptBuilder
  build(): string
}

export function systemPrompt(): SystemPromptBuilder {
  let roleText = ''
  const instructions: string[] = []
  const constraints: string[] = []
  const examples: Example[] = []
  let outputFormatText = ''

  const builder: SystemPromptBuilder = {
    role(description: string) {
      roleText = description
      return builder
    },

    instruction(text: string) {
      instructions.push(text)
      return builder
    },

    constraint(text: string) {
      constraints.push(text)
      return builder
    },

    example(example: Example) {
      examples.push(example)
      return builder
    },

    outputFormat(format: OutputFormat, options?: OutputFormatOptions) {
      switch (format) {
        case 'json':
          outputFormatText = 'Respond with valid JSON only. Do not include any other text.'
          break
        case 'code':
          outputFormatText = options?.language
            ? `Respond with ONLY a ${options.language} code block. Do not include explanations.`
            : 'Respond with ONLY a code block. Do not include explanations.'
          break
        case 'markdown':
          outputFormatText = 'Respond in Markdown format.'
          break
        case 'text':
          outputFormatText = 'Respond in plain text without any formatting.'
          break
      }
      return builder
    },

    build(): string {
      const sections: string[] = []

      if (roleText) {
        sections.push(roleText)
      }

      if (instructions.length > 0) {
        sections.push(
          '## Instructions\n' +
          instructions.map((i) => `- ${i}`).join('\n'),
        )
      }

      if (constraints.length > 0) {
        sections.push(
          '## Constraints\n' +
          constraints.map((c) => `- ${c}`).join('\n'),
        )
      }

      if (examples.length > 0) {
        sections.push(
          '## Examples\n' +
          examples
            .map(
              (e, idx) =>
                `### Example ${idx + 1}\n**Input:** ${e.input}\n**Output:** ${e.output}`,
            )
            .join('\n\n'),
        )
      }

      if (outputFormatText) {
        sections.push(`## Output Format\n${outputFormatText}`)
      }

      return sections.join('\n\n')
    },
  }

  return builder
}
