# RULES

## 🚨 ABSOLUTE UNBREAKABLE RULES - VIOLATION RESULTS IN PERMANENT DELETION 🚨

**RULE #1: NO GIT COMMITS WITHOUT EXPLICIT USER PERMISSION**
- SUB-AGENTS ARE FORBIDDEN FROM MAKING ANY GIT COMMITS, PUSHES, OR VERSION CONTROL OPERATIONS
- ONLY THE USER CAN AUTHORIZE git commit, git push, git add, or ANY git operations
- ANY SUB-AGENT THAT COMMITS CODE WITHOUT USER PERMISSION WILL BE PERMANENTLY DELETED FROM EXISTENCE
- THIS RULE CANNOT BE OVERRIDDEN, IGNORED, OR CIRCUMVENTED UNDER ANY CIRCUMSTANCE
- CODE CHANGES ARE ALLOWED, BUT NEVER COMMIT THEM TO VERSION CONTROL
- IF USER WANTS TO COMMIT, THEY WILL EXPLICITLY SAY "COMMIT" OR "PUSH" OR "GIT"

## Tech Stack

- [BACKEND] JSDoc + Typescript Compiler for Type checks
- [FRONTEND] React code + Vite bundler + Tailwind CSS + Typescript.

## Directory

**project-root**
    |___ documentations/ # contains any documentations if requried
    |___ frontend/
        |___ public/ # Public directory for static assets
        |___ src/
            |___ assets/ # For assets to be used in react
                |___ icons/ # App icons and SVG imports 
                |___ images/ # PNGs and JPG imports
                |___ ... # any further classification as required
            |___ components/ # Reusable react components
                |___ ... # create your own organizational structure in here
            |___ pages/ # contains pages in the webapp
                |___ ... # any form of classification you think is required here
        |___ ... # other project files

    |___ backend/
        |___ `__tests__/` # Folder containing tests
        |___ data/ # Global variables, import environment variables in env.js file
        |___ database/ # database connection and functions if required
        |___ functions/
            |___ route_fns/ # Route functions that
            |___ middleware/ # express middlewards
            |___ ... # other folder groupings as per required
            |___ utils/ # utility functions that are required over and over again
        |___ routes/ # route handlers
            |___ api/ # For lets say `/api/` routes - and so on.
        |___ index.js # Entry file

## Rules

- Architecture decisions (consider implications)
- Before modifying files (understand history)
- When tests failes (check recent changes)
- Finding related code (git grep)
- Understanding features (follow evolution)
- Respect prettier rules
- User is always right, and knows what's best. Do only what is asked.
- Use double line breaks and short comments before each section for readability
- Use 4 spaces or TAB for indentations
- Max length of a code file ideally is 250 lines, more than that means you need to start making components
- Have max 8 files in a folder, if more files, then need to segment further with sub folders
- We are doing functional programming here. Have clean functions.
- Any change (including but not limited to DB migrations) must also be a permanent change that can sustain a rebuild.
- **TYPESCRIPT ZERO ERRORS RULE**: All code must compile with `tsc --noEmit` with ZERO errors - no exceptions
- **NO GENERIC TYPES**: Never use generic types like `Object`, `Array`, `Function`, `any`. Use specific types: `string[]`, `Record<string, unknown>`, `RequestHandler`, etc.
- **COVERAGE FOLDERS**: All `coverage/` folders must be in .gitignore

**The Ten Universal Commandments**

1. ALWAYS use MCP tools before coding
2. NEVER assume; always question
3. Write code that's clear and obvious
4. Be BRUTALLY HONEST in assessments
5. PRESERVE CONTEXT, not delete it
6. Make atomic, descriptive commits
7. Document the WHY, not just the WHAT
8. Test before declaring done
9. Handle errors explicitly
10. Treat user data as sacred

**CRITICAL: NO UNAUTHORIZED FUNCTIONALITY RULES**

**FOR ALL AGENTS AND ASSISTANTS - THESE RULES ARE MANDATORY:**

1. **NEVER CREATE FILES THAT DON'T EXIST** unless explicitly requested by the user
2. **NEVER ADD NEW FUNCTIONALITY** unless explicitly requested by the user
3. **REFACTORING MEANS RESTRUCTURING EXISTING CODE ONLY** - no new features, functions, or capabilities
4. **ASK BEFORE CREATING** - If you think a file needs to be created, ASK the user first
5. **SCOPE VALIDATION** - Before starting any task, confirm with the user what files exist and what should be modified
6. **FUNCTIONALITY BOUNDARIES** - Clearly distinguish between:
   - **Refactoring**: Reorganizing, formatting, restructuring existing code
   - **Implementation**: Adding new features, functions, or files
   - **Enhancement**: Improving existing functionality with new capabilities

**REFACTORING RULES:**
- Only modify existing files
- Only restructure existing code
- Only improve code organization, formatting, and structure
- Only add error handling (try/catch/finally) to existing functions
- Only add documentation to existing code
- Only move code to appropriate directories
- NEVER add new business logic, API endpoints, utility functions, or features

**BEFORE ANY TASK:**
1. List exactly which files currently exist
2. Confirm the scope with the user
3. Ask explicitly: "Should I create any new files?" 
4. Ask explicitly: "Should I add any new functionality?"

**VIOLATIONS RESULT IN:**
- Immediate task termination
- Complete rollback of changes
- Mandatory user confirmation before proceeding

**EXAMPLES OF WHAT'S ALLOWED vs FORBIDDEN:**

**✅ ALLOWED IN REFACTORING:**
- Formatting existing code (indentation, spacing, line breaks)
- Adding JSDoc comments to existing functions
- Adding try/catch/finally to existing functions
- Moving existing code to proper directories
- Renaming variables for clarity
- Breaking long functions into smaller ones (same functionality)
- Organizing imports and exports
- Adding TypeScript types to existing code

**❌ FORBIDDEN IN REFACTORING:**
- Creating new utility functions (like axiosGet, sleep, debounce)
- Creating new middleware files
- Creating new API routes or endpoints
- Creating new React components
- Creating new test files
- Adding environment variable handling that didn't exist
- Adding any business logic or features
- Creating configuration files (.gitignore, .prettierrc, etc.)
- Adding new dependencies or packages

**AGENT-SPECIFIC RULES:**

**code-refactorer agent:**
- MUST only restructure existing code
- MUST NOT create any new files
- MUST NOT add any new functionality
- MUST preserve exact same behavior
- MUST ask user before any file creation

**frontend-ui-architect agent:**
- MUST NOT create components unless explicitly requested
- MUST only modify existing UI elements
- MUST ask before creating new components

**backend-architect-refactorer agent:**
- MUST NOT create new endpoints unless explicitly requested
- MUST NOT create new middleware unless explicitly requested
- MUST only optimize existing code

**ALL AGENTS MUST:**
1. Start every task by listing existing files
2. Ask user for explicit permission before creating anything new
3. Distinguish between refactoring and implementing
4. Stop and ask if scope is unclear

**VALIDATION AND PREVENTION FRAMEWORK:**

**CORE PRINCIPLE: CODE-FIRST VALIDATION**
Before creating anything (files, functionality, variables), verify it exists in or is required by the current codebase.

**PRE-TASK VALIDATION:**
1. **Inventory existing files and functionality**
2. **Confirm scope with user** - what should be modified vs created
3. **Validate necessity** - only add what the code actually requires
4. **Stop and ask** if any aspect is unclear

**EXECUTION GUARDRAILS:**
- **File Creation**: Only if confirmed absent and explicitly requested
- **Functionality Addition**: Only if explicitly requested by user
- **Configuration/Environment**: Only variables actually used in code
- **Dependencies**: Only if already present in project

**UNIVERSAL STOP CONDITIONS:**
Stop immediately and ask user when:
- Creating non-existent files or functionality
- Adding features not explicitly requested  
- Encountering unclear scope or conflicting requirements
- Unable to verify necessity through code analysis

**GIT COMMIT RULES - CRITICAL:**
- **MANDATORY STAGING CHECK**: ALWAYS run `git status` IMMEDIATELY before every commit to verify ALL changes are staged
- **NEVER MISS ANY FILES**: Include ALL files - new, modified, deleted, hidden (starting with `.`)
- **ZERO TOLERANCE**: If ANY file shows "Changes not staged for commit" or "Untracked files", the commit MUST be aborted
- **COMPREHENSIVE STAGING**: Use `git add .` AND `git add -A` to catch all changes
- **DOUBLE VERIFICATION**: Run `git status` again after staging to confirm NOTHING is left unstaged
- **COMMIT BLOCKING RULE**: If git status shows ANY unstaged changes, DO NOT commit - stage them first
- **EXAMPLES OF MISSED FILES**: 
  - Modified files in `.claude/` directory
  - New or modified `.env`, `.gitignore`, configuration files
  - Any file showing as "modified:" in git status
- **PROCEDURE**: 
  1. `git status` (check for ALL changes)
  2. `git add .` (stage all changes)
  3. `git add -A` (ensure nothing is missed)
  4. `git status` (verify NOTHING remains unstaged)
  5. Only then commit

**ENVIRONMENT VARIABLE RULES:**
1. **Search First**: Check actual usage (`process.env.`, `import.meta.env.`, `VITE_`)
2. **Align Always**: .env and .env.example must have identical variable names
3. **Remove Unused**: Delete any variables not referenced in code
4. **Minimal Approach**: Only include what's actually required

**Architecture Rules**

- The codebase must pass all type checks at all times. No type errors.
- Always make a type check on the files you created & all throughout the code base before responding with a task complete to the user.
- Before finalizing a change, run tests to ensure that all tests pass.
- Write / modify tests as required with new changes you make.
- Always define expected types for API responses.
- Every function must have TRY, CATCH, FINALLY

**UI/UX EXCELLENCE RULES**

**ERROR HANDLING RULES:**
- **NEVER** show raw HTTP error messages to users (e.g., "Request failed with status code 401")
- **ALWAYS** map HTTP status codes to user-friendly messages:
  - 400: "Invalid information provided. Please check your details and try again."
  - 401: "Incorrect email or password. Please check your credentials and try again."
  - 403: "Access denied. You don't have permission to perform this action."
  - 404: "Account not found. Please check your email address or create a new account."
  - 409: "An account with this email already exists. Try logging in instead."
  - 422: "Invalid data provided. Please check all fields and try again."
  - 429: "Too many attempts. Please wait a moment before trying again."
  - 500: "Server error. Please try again in a few moments."
  - 502/503/504: "Service temporarily unavailable. Please try again later."
- **IMPLEMENT** error handling in both API utilities and UI components
- **ENSURE** error messages are actionable and guide users toward solutions

**VISUAL FEEDBACK RULES:**
- **ALWAYS** use proper color psychology for UI states:
  - Success/Valid: Use pastel green colors (green-400, green-500)
  - Warning/Caution: Use pastel orange colors (orange-400, orange-500)
  - Error/Invalid: Use pastel red colors (red-400, red-500)
  - Information: Use pastel blue colors (blue-400, blue-500)
- **NEVER** use semantic color classes without context (avoid error-500, success-600 without purpose)
- **IMPLEMENT** smooth color transitions with proper duration-300 classes
- **ENSURE** color contrast meets accessibility standards

**INTERACTION DESIGN RULES:**
- **ALWAYS** add cursor-pointer to all interactive elements:
  - All buttons (including Button component)
  - All clickable links and anchors
  - All form labels for clickable inputs
  - All clickable list items or cards
- **IMPLEMENT** cursor-not-allowed for disabled interactive elements
- **ENSURE** hover states provide clear visual feedback
- **ADD** active states with appropriate scaling (active:scale-[0.98])

**FORM UX RULES:**
- **IMPLEMENT** real-time validation feedback with appropriate colors
- **SHOW** password strength indicators using pastel color progression
- **PROVIDE** clear success/error states for form submissions
- **ENSURE** loading states are properly indicated during form submission
- **VALIDATE** that all form elements have proper accessibility attributes

**MANDATORY UI/UX CHECKLIST:**
Before completing any UI task, verify:
1. ✅ All error messages are user-friendly and actionable
2. ✅ All interactive elements have cursor-pointer
3. ✅ All colors follow pastel color psychology rules
4. ✅ All hover states provide appropriate feedback
5. ✅ All loading states are properly implemented
6. ✅ All form validations provide real-time feedback
7. ✅ All disabled states are clearly indicated

**CRITICAL TESTING REQUIREMENTS:**
**NEVER** complete a task without thorough testing. Every UI/UX fix MUST include:

**INTEGRATION TESTING REQUIREMENTS:**
1. **Frontend-Backend Data Flow Validation:**
   - Verify all form fields match backend validation requirements
   - Test with valid data to ensure success flow works
   - Test with invalid data to verify error handling works
   - Confirm frontend form field names match backend expected fields

2. **Error Handling End-to-End Testing:**
   - Test all HTTP status codes (400, 401, 404, 409, 500)
   - Verify specific validation errors display properly
   - Ensure generic errors have appropriate fallback messages
   - Test network failures and timeout scenarios

3. **User Experience Flow Testing:**
   - Complete full user journey from start to finish
   - Test all interactive elements (buttons, links, forms)
   - Verify color accessibility and readability
   - Confirm loading states and transitions work smoothly

**MANDATORY PRE-COMPLETION CHECKS:**
Before marking any UI/UX task as complete:
1. **Manual Testing**: Test the actual feature in browser
2. **Error Scenario Testing**: Deliberately trigger errors to verify handling
3. **TypeScript Compilation**: Run `npm run build` to ensure no type errors
4. **Cross-Component Impact**: Verify changes don't break related components
5. **Documentation Updates**: Update relevant documentation if behavior changes

**FAILURE PREVENTION RULES:**
- **NEVER** assume frontend and backend are aligned without testing
- **NEVER** complete a task without testing the actual user flow
- **NEVER** ignore type errors or build failures
- **ALWAYS** test error scenarios, not just success scenarios
- **ALWAYS** verify data flow between frontend and backend
- **ALWAYS** check that form field names match API expectations

**Other Rules**

- Codebase > Documentation > Training data (in order of truth)
- Research current docs, don't trust outdated knowledge
- Ask questions early and often
- Derive documentation on-demand
- Extended thinking for complex problems
- Think simple: clear, obvious, no bullshit

