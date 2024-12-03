export function validateParagraphs(section, template) {
  const errors = [];

  if (template.paragraphs) {
    // Max
    if (
      template.paragraphs.min &&
      section.paragraphs.length < template.paragraphs.min
    ) {
      errors.push({
        head: section.heading.content,
        position: section.position,
        message: `Expected at least ${template.paragraphs.min} paragraphs, but found ${section.paragraphs.length}`,
      });
    }

    // Min
    if (
      template.paragraphs.max &&
      section.paragraphs.length > template.paragraphs.max
    ) {
      errors.push({
        head: section.heading.content,
        position: section.position,
        message: `Expected at most ${template.paragraphs.max} paragraphs, but found ${section.paragraphs.length}`,
      });
    }

    // Patterns
    if (template.paragraphs.patterns) {
      const patterns = template.paragraphs.patterns;
      const patternCount = patterns.length;
      const paragraphCount = section.paragraphs.length;
      for (let i = 0; i < paragraphCount; i++) {
        const paragraph = section.paragraphs[i];
        if (patterns[i % patternCount] && !patterns[i % patternCount].test(paragraph.content)) {
          errors.push({
            head: section.heading.content,
            position: paragraph.position,
            message: `Paragraph does not match pattern: ${patterns[i % patternCount]}`,
          });
        }
      }
    }
  }

  return errors;
}
