interface Example {
  input: string;
  output: string;
}

type OutputFormat = 'json' | 'code' | 'markdown' | 'text';

interface SystemPromptBuilder {
  /**
   * Sets the role or persona that the language model should adopt when generating responses.
   */
  role(description: string): SystemPromptBuilder;
  /**
   * Adds an instruction or guideline for the language model to follow when generating responses.
   */
  instruction(text: string): SystemPromptBuilder;
  /**
   * Adds few-shot examples to the system prompt.
   */
  example(example: Example): SystemPromptBuilder;
  /**
   * Specifies the desired output format for the language model's responses, such as JSON, code, Markdown, or plain text.
   */
  outputFormat(format: OutputFormat): SystemPromptBuilder;
  /**
   * Builds and returns the final system prompt string based on the provided role, instructions, examples, and output format.
   */
  build(): string;
}

/**
 * Returns a builder for constructing a system prompt string with a fluent API.
 */
export function systemPrompt(): SystemPromptBuilder {
  let roleText = '';
  const instructions: string[] = [];
  const examples: Example[] = [];
  let outputFormatText = '';

  const builder: SystemPromptBuilder = {
    role(description: string) {
      roleText = description;
      return builder;
    },

    instruction(text: string) {
      instructions.push(text);
      return builder;
    },

    example(example: Example) {
      examples.push(example);
      return builder;
    },

    outputFormat(format: OutputFormat) {
      switch (format) {
        case 'json':
          outputFormatText = 'Respond with valid JSON only. Do not include any other text.';
          break;
        case 'code':
          outputFormatText = 'Respond with ONLY a code block. Do not include explanations.';
          break;
        case 'markdown':
          outputFormatText = 'Respond in Markdown format.';
          break;
        case 'text':
          outputFormatText = 'Respond in plain text without any formatting.';
          break;
      }
      return builder;
    },

    build(): string {
      const sections: string[] = [];

      if (roleText) {
        sections.push(roleText);
      }

      if (instructions.length > 0) {
        sections.push('## Instructions\n' + instructions.map((i) => `- ${i}`).join('\n'));
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
        );
      }

      if (outputFormatText) {
        sections.push(`## Output Format\n${outputFormatText}`);
      }

      return sections.join('\n\n');
    },
  };

  return builder;
}
