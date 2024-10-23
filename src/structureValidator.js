import { validateHeading } from "./rules/headingValidator.js";
import { validateParagraphs } from "./rules/paragraphsValidator.js";
import { validateCodeBlocks } from "./rules/codeBlocksValidator.js";
import { validateSubsections } from "./rules/subsectionsValidator.js";

// Evaluate a template against a document
export function validateStructure(structure, template) {
  let errors = [];

  // TODO: Check frontmatter

  // Check sections
  if (template.sections && structure.sections) {
    for (let i = 0; i < Object.keys(template.sections).length; i++) {
      const templateKey = Object.keys(template.sections)[i];
      const templateSection = template.sections[templateKey];
      const structureSection = structure.sections[i];

      // Check heading
      if (templateSection.heading && structureSection.heading) {
        errors = errors.concat(
          validateHeading(structureSection, templateSection)
        );
      }

      // Check paragraphs
      if (templateSection.paragraphs && structureSection.paragraphs) {
        errors = errors.concat(validateParagraphs(structure, template));
      }

      // Check code blocks
      if (templateSection.code_blocks && structureSection.codeBlocks) {
        errors = errors.concat(validateCodeBlocks(structure, template));
      }

      // Check subsections
      if (templateSection.sections) {
        if (!structureSection.sections) {
          errors.push({
            type: "missing_section",
            section: templateKey,
            message: `Missing section ${templateKey}`,
          });
        } else {
          errors = errors.concat(
            validateStructure(structureSection, templateSection)
          );
        }
      }
    }
  }
  return errors;
}
