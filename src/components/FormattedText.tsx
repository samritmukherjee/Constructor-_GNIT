import React from 'react';
import { Text, View } from 'react-native';

interface FormattedTextProps {
  text: string;
  isUser: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, isUser }) => {
  const textColor = isUser ? 'text-white' : 'text-gray-800';
  
  // Parse markdown-style text into structured blocks
  const parseText = (rawText: string) => {
    const lines = rawText.split('\n');
    const blocks: Array<{
      type: 'heading1' | 'heading2' | 'list' | 'text';
      content: string;
      emoji?: string;
    }> = [];

    let currentListItems: string[] = [];
    
    const flushList = () => {
      if (currentListItems.length > 0) {
        blocks.push({ type: 'list', content: currentListItems.join('\n') });
        currentListItems = [];
      }
    };

    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines
      if (!line) {
        flushList();
        continue;
      }

      // Detect heading 1: **text** or ## text
      if (line.match(/^#{1,2}\s+(.+)$/) || line.match(/^\*\*([^*]+)\*\*$/)) {
        flushList();
        const content = line
          .replace(/^#{1,2}\s+/, '')
          .replace(/^\*\*/, '')
          .replace(/\*\*$/, '')
          .trim();
        
        // Extract emoji if present at the start
        const emojiMatch = content.match(/^([\u{1F300}-\u{1F9FF}])\s*(.+)/u);
        if (emojiMatch) {
          blocks.push({ type: 'heading1', content: emojiMatch[2], emoji: emojiMatch[1] });
        } else {
          blocks.push({ type: 'heading1', content });
        }
        continue;
      }

      // Detect heading 2: *text*
      if (line.match(/^\*([^*]+)\*$/)) {
        flushList();
        const content = line.replace(/^\*/, '').replace(/\*$/, '').trim();
        const emojiMatch = content.match(/^([\u{1F300}-\u{1F9FF}])\s*(.+)/u);
        if (emojiMatch) {
          blocks.push({ type: 'heading2', content: emojiMatch[2], emoji: emojiMatch[1] });
        } else {
          blocks.push({ type: 'heading2', content });
        }
        continue;
      }

      // Detect list items: -, *, •, or numbered
      if (line.match(/^[\-\*•]\s+/) || line.match(/^\d+[\.\)]\s+/)) {
        currentListItems.push(line);
        continue;
      }

      // Regular text
      flushList();
      blocks.push({ type: 'text', content: line });
    }
    
    flushList();
    return blocks;
  };

  // Remove markdown syntax from inline text (bold, italic)
  const cleanInlineMarkdown = (str: string): string => {
    return str
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold markers
      .replace(/\*(.+?)\*/g, '$1')     // Remove italic markers
      .replace(/__(.+?)__/g, '$1')     // Remove underline bold
      .replace(/_(.+?)_/g, '$1');      // Remove underline italic
  };

  const blocks = parseText(text);

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'heading1') {
          return (
            <View key={index} className="mb-3">
              <Text className={`text-xl font-bold ${textColor}`} style={{ lineHeight: 28 }}>
                {block.emoji && `${block.emoji} `}{cleanInlineMarkdown(block.content)}
              </Text>
            </View>
          );
        }

        if (block.type === 'heading2') {
          return (
            <View key={index} className="mb-2">
              <Text className={`text-lg font-bold ${textColor}`} style={{ lineHeight: 24 }}>
                {block.emoji && `${block.emoji} `}{cleanInlineMarkdown(block.content)}
              </Text>
            </View>
          );
        }

        if (block.type === 'list') {
          const items = block.content.split('\n');
          return (
            <View key={index} className="mb-2">
              {items.map((item, idx) => {
                // Clean the list marker and get content
                const cleanItem = item
                  .replace(/^[\-\*•]\s+/, '')
                  .replace(/^\d+[\.\)]\s+/, '');
                
                return (
                  <View key={idx} className="flex-row mb-1" style={{ paddingLeft: 8 }}>
                    <Text className={`${textColor}`} style={{ marginRight: 8 }}>•</Text>
                    <Text className={`flex-1 ${textColor}`} style={{ lineHeight: 22 }}>
                      {cleanInlineMarkdown(cleanItem)}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Regular text
        return (
          <Text key={index} className={`${textColor} mb-1`} style={{ lineHeight: 22 }}>
            {cleanInlineMarkdown(block.content)}
          </Text>
        );
      })}
    </View>
  );
};
