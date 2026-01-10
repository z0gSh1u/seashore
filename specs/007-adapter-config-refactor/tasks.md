# Tasks: LLM Adapter Configuration Refactor

**Input**: Design documents from `/specs/007-adapter-config-refactor/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Included (Constitution requires "测试即门禁")

**Organization**: Tasks organized by user story for independent implementation.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Type definitions and helper functions that all user stories depend on

- [x] T001 Define default base URL constants in packages/llm/src/types.ts
- [x] T002 [P] Update EmbeddingAdapter interface to add apiKey and baseURL fields in packages/llm/src/types.ts
- [x] T003 [P] Update ImageAdapter interface to add apiKey and baseURL fields in packages/llm/src/types.ts
- [x] T004 [P] Update VideoAdapter interface to add apiKey and baseURL fields in packages/llm/src/types.ts
- [x] T005 [P] Update TranscriptionAdapter interface to add apiKey and baseURL fields in packages/llm/src/types.ts
- [x] T006 [P] Update TTSAdapter interface to add apiKey and baseURL fields in packages/llm/src/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared helper function that all adapter implementations need

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [x] T007 Refactor getEnvVar helper to support optional apiKey override in packages/llm/src/embedding.ts
- [x] T008 [P] Create shared getApiKey helper function that implements priority logic (code > env) in packages/llm/src/multimodal.ts
- [x] T009 [P] Create shared buildBaseUrl helper function for URL construction in packages/llm/src/embedding.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 使用自定义 API 端点生成 Embeddings (Priority: P1) 🎯 MVP

**Goal**: Enable openaiEmbed and geminiEmbed to accept apiKey and baseURL configuration

**Independent Test**: Create embedding adapter with custom endpoint, verify requests go to custom URL

### Tests for User Story 1

- [ ] T010 [P] [US1] Add unit test for openaiEmbed with apiKey option in packages/llm/__tests__/embedding.test.ts
- [ ] T011 [P] [US1] Add unit test for openaiEmbed with baseURL option in packages/llm/__tests__/embedding.test.ts
- [ ] T012 [P] [US1] Add unit test for geminiEmbed with apiKey option in packages/llm/__tests__/embedding.test.ts
- [ ] T013 [P] [US1] Add unit test for backward compatibility (no options) in packages/llm/__tests__/embedding.test.ts

### Implementation for User Story 1

- [x] T014 [US1] Update openaiEmbed function signature to accept options parameter in packages/llm/src/embedding.ts
- [x] T015 [US1] Update geminiEmbed function signature to accept options parameter in packages/llm/src/embedding.ts
- [x] T016 [US1] Update generateOpenAIEmbedding to use adapter.apiKey and adapter.baseURL in packages/llm/src/embedding.ts
- [x] T017 [US1] Update generateOpenAIBatchEmbeddings to use adapter.apiKey and adapter.baseURL in packages/llm/src/embedding.ts
- [x] T018 [US1] Update generateGeminiEmbedding to use adapter.apiKey and adapter.baseURL in packages/llm/src/embedding.ts
- [x] T019 [US1] Update generateGeminiBatchEmbeddings to use adapter.apiKey and adapter.baseURL in packages/llm/src/embedding.ts
- [ ] T020 [US1] Run embedding tests to verify all scenarios pass

**Checkpoint**: Embedding adapters fully functional with custom configuration - MVP complete

---

## Phase 4: User Story 2 - 使用自定义端点生成图像 (Priority: P2)

**Goal**: Enable openaiImage and geminiImage to accept apiKey and baseURL configuration

**Independent Test**: Create image adapter with custom endpoint, verify configuration is used

### Tests for User Story 2

- [ ] T021 [P] [US2] Add unit test for openaiImage with apiKey and baseURL options in packages/llm/__tests__/multimodal.test.ts
- [ ] T022 [P] [US2] Add unit test for geminiImage with apiKey option in packages/llm/__tests__/multimodal.test.ts

### Implementation for User Story 2

- [x] T023 [US2] Update openaiImage function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T024 [US2] Update geminiImage function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T025 [US2] Update generateOpenAIImage to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [x] T026 [US2] Update generateGeminiImage to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [ ] T027 [US2] Run image generation tests to verify all scenarios pass

**Checkpoint**: Image adapters fully functional with custom configuration

---

## Phase 5: User Story 3 - 使用自定义端点进行语音转文字 (Priority: P2)

**Goal**: Enable openaiTranscription to accept apiKey and baseURL configuration

**Independent Test**: Create transcription adapter with custom endpoint, verify configuration is used

### Tests for User Story 3

- [ ] T028 [P] [US3] Add unit test for openaiTranscription with apiKey and baseURL options in packages/llm/__tests__/multimodal.test.ts

### Implementation for User Story 3

- [x] T029 [US3] Update openaiTranscription function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T030 [US3] Update generateTranscription to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [ ] T031 [US3] Run transcription tests to verify all scenarios pass

**Checkpoint**: Transcription adapter fully functional with custom configuration

---

## Phase 6: User Story 4 - 使用自定义端点进行 TTS (Priority: P2)

**Goal**: Enable openaiTTS and geminiTTS to accept apiKey and baseURL configuration

**Independent Test**: Create TTS adapter with custom endpoint, verify configuration is used

### Tests for User Story 4

- [ ] T032 [P] [US4] Add unit test for openaiTTS with apiKey and baseURL options in packages/llm/__tests__/multimodal.test.ts
- [ ] T033 [P] [US4] Add unit test for geminiTTS with apiKey option in packages/llm/__tests__/multimodal.test.ts

### Implementation for User Story 4

- [x] T034 [US4] Update openaiTTS function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T035 [US4] Update geminiTTS function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T036 [US4] Update generateOpenAISpeech to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [x] T037 [US4] Update generateGeminiSpeech to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [ ] T038 [US4] Run TTS tests to verify all scenarios pass

**Checkpoint**: TTS adapters fully functional with custom configuration

---

## Phase 7: User Story 5 - 使用自定义端点进行视频生成 (Priority: P3)

**Goal**: Enable openaiVideo to accept apiKey and baseURL configuration

**Independent Test**: Create video adapter with custom endpoint, verify configuration is used

### Tests for User Story 5

- [ ] T039 [P] [US5] Add unit test for openaiVideo with apiKey and baseURL options in packages/llm/__tests__/multimodal.test.ts

### Implementation for User Story 5

- [x] T040 [US5] Update openaiVideo function signature to accept options parameter in packages/llm/src/multimodal.ts
- [x] T041 [US5] Update generateVideo to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [x] T042 [US5] Update checkVideoStatus to use adapter.apiKey and adapter.baseURL in packages/llm/src/multimodal.ts
- [ ] T043 [US5] Run video generation tests to verify all scenarios pass

**Checkpoint**: Video adapter fully functional with custom configuration

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [x] T044 [P] Update index.ts exports if needed in packages/llm/src/index.ts
- [x] T045 [P] Run full test suite with pnpm test in packages/llm
- [ ] T046 [P] Run TypeScript type check with pnpm exec tsc --noEmit (NOTE: Pre-existing issues in project)
- [ ] T047 [P] Run linter with pnpm lint (NOTE: Pre-existing eslint config issue - typescript-eslint package missing)
- [x] T048 Verify backward compatibility by running existing examples
- [x] T049 Update README.md with new configuration options in packages/llm/README.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phases 3-7 (User Stories)**: All depend on Phase 2 completion
  - Can proceed in parallel or sequentially by priority (P1 → P2 → P3)
- **Phase 8 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational → No dependencies on other stories → **MVP**
- **User Story 2 (P2)**: After Foundational → Independent of other stories
- **User Story 3 (P2)**: After Foundational → Independent of other stories
- **User Story 4 (P2)**: After Foundational → Independent of other stories
- **User Story 5 (P3)**: After Foundational → Independent of other stories

### Parallel Opportunities per Phase

```text
Phase 1: T002, T003, T004, T005, T006 can run in parallel (different interface types)
Phase 2: T007, T008, T009 can run in parallel (different helper functions)
Phase 3: T010, T011, T012, T013 tests in parallel; T014, T015 in parallel
Phase 4: T021, T022 in parallel; T023, T024 in parallel
Phase 5: Single test T028
Phase 6: T032, T033 in parallel; T034, T035 in parallel
Phase 7: Single test T039
Phase 8: T044, T045, T046, T047 in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (helpers)
3. Complete Phase 3: User Story 1 (embedding)
4. **STOP and VALIDATE**: Run tests, verify embedding works
5. Deploy/merge if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. User Story 1 → Test → **MVP Ready!**
3. User Story 2 → Test → Image generation ready
4. User Stories 3 & 4 → Test → Transcription + TTS ready
5. User Story 5 → Test → Video ready
6. Polish → Complete

---

## Summary

| Phase | Tasks | Parallel | Files Modified |
|-------|-------|----------|----------------|
| Setup | T001-T006 | 5/6 | types.ts |
| Foundational | T007-T009 | 2/3 | embedding.ts, multimodal.ts |
| US1 (Embedding) | T010-T020 | 5/11 | embedding.ts, embedding.test.ts |
| US2 (Image) | T021-T027 | 4/7 | multimodal.ts, multimodal.test.ts |
| US3 (Transcription) | T028-T031 | 1/4 | multimodal.ts, multimodal.test.ts |
| US4 (TTS) | T032-T038 | 4/7 | multimodal.ts, multimodal.test.ts |
| US5 (Video) | T039-T043 | 1/5 | multimodal.ts, multimodal.test.ts |
| Polish | T044-T049 | 4/6 | index.ts, README.md |

**Total**: 49 tasks, 26 parallelizable
