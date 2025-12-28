# Feature Specification: LLM Configuration Alignment

**Feature Branch**: `004-llm-config-baseurl`
**Created**: 2025-12-28
**Status**: Draft
**Input**: User description: "Support configuring model call baseURL for the llm module, specifically, the llm configuration options should be the same as those exposed by @tanstack/ai"

## User Scenarios & Testing

### User Story 1 - Configure Custom Base URL (Priority: P1)

As a developer using the `llm` package, I want to configure a custom `baseURL` for my LLM provider so that I can use local LLMs (e.g., Ollama, LM Studio) or corporate proxies.

**Why this priority**: Essential for flexibility and supporting non-standard endpoints, which is a common requirement for enterprise and local development.

**Independent Test**: Can be fully tested by pointing the `llm` config to a mock server or a local LLM instance and verifying the request reaches the custom URL.

**Acceptance Scenarios**:

1. **Given** a `TextAdapterConfig` with `baseURL` set to "http://localhost:1234/v1", **When** the adapter is initialized and a request is made, **Then** the request is sent to "http://localhost:1234/v1".
2. **Given** a `TextAdapterConfig` without a `baseURL`, **When** the adapter is initialized, **Then** it defaults to the provider's standard URL (e.g., OpenAI API).

---

### User Story 2 - Explicit API Key Configuration (Priority: P2)

As a developer, I want to pass the `apiKey` explicitly in the configuration object instead of relying solely on environment variables, so that I can manage secrets dynamically or support multiple keys.

**Why this priority**: Improves security and flexibility in secret management.

**Independent Test**: Initialize the adapter with a specific API key and verify it is used for authentication.

**Acceptance Scenarios**:

1. **Given** a `TextAdapterConfig` with a specific `apiKey`, **When** a request is made, **Then** the request uses that API key for authentication.

---

### User Story 3 - Full Provider Configuration Support (Priority: P3)

As a developer, I want to pass additional provider-specific options (like `headers`, `fetch` polyfills) to the `llm` adapter, so that I can fully customize the network behavior as supported by `@tanstack/ai`.

**Why this priority**: Ensures full parity with the underlying library and supports advanced use cases.

**Independent Test**: Configure custom headers and verify they are present in the outgoing request.

**Acceptance Scenarios**:

1. **Given** a `TextAdapterConfig` with custom `headers`, **When** a request is made, **Then** the headers are included in the request.

### Edge Cases

- **Invalid Base URL**: If `baseURL` is not a valid URL, the system should throw a clear error during initialization or request.
- **Conflicting Configuration**: If both environment variables and explicit config are present (e.g., API Key), the explicit configuration MUST take precedence.
- **Provider Mismatch**: If configuration options specific to one provider are passed to another (if types allow), they should be ignored or cause a validation error.

## Requirements

### Functional Requirements

- **FR-001**: The `TextAdapterConfig` interface MUST support `baseURL` (string).
- **FR-002**: The `TextAdapterConfig` interface MUST support `apiKey` (string).
- **FR-003**: The `TextAdapterConfig` interface MUST support `headers` (Record<string, string>).
- **FR-004**: The `TextAdapterConfig` interface SHOULD support other standard options exposed by `@tanstack/ai` provider factories (e.g., `fetch`).
- **FR-005**: The `llm` module MUST pass these configuration options to the underlying `@tanstack/ai` provider initialization (e.g., `createOpenAI({ baseURL: ... })`).
- **FR-006**: The system MUST prioritize explicitly configured values over environment variables where applicable (standard `@tanstack/ai` behavior).

### Key Entities

- **TextAdapterConfig**: The configuration object used to initialize LLM adapters. It will be expanded to include `baseURL`, `apiKey`, `headers`, etc.
