# WayfinderInterface Refactoring Plan

## Current Issues

1. **2,626 lines in single component** - Violates Single Responsibility Principle
2. **144 console.log statements** - Excessive debugging, should be conditional
3. **Mixed concerns** - UI, business logic, and data persistence all together
4. **Repeated patterns** - localStorage operations, coordinate calculations
5. **No separation** - Everything in one giant file

## Refactoring Strategy

### Phase 1: Extract Utilities ✅ (Started)
- [x] `src/utils/storage.ts` - Centralized localStorage operations
- [x] `src/utils/pathfinding.ts` - Pathfinding algorithms and utilities
- [x] `src/utils/logger.ts` - Conditional logging utility
- [x] `src/hooks/useMapData.ts` - Map data management hook

### Phase 2: Extract Custom Hooks
- [ ] `src/hooks/useRouteGeneration.ts` - Route calculation logic
- [ ] `src/hooks/useMapInteraction.ts` - Mouse/keyboard event handling
- [ ] `src/hooks/useDrawingMode.ts` - Path drawing state management

### Phase 3: Extract Components
- [ ] `src/components/MapView.tsx` - Map rendering (SVG, markers, routes)
- [ ] `src/components/RouteControls.tsx` - Find route UI
- [ ] `src/components/LocationEditor.tsx` - Location marker editing
- [ ] `src/components/RouteVisualization.tsx` - Animated chevrons and path rendering

### Phase 4: Clean Up
- [ ] Remove excessive console.logs (replace with logger utility)
- [ ] Remove commented-out code
- [ ] Consolidate duplicate logic
- [ ] Add proper TypeScript types
- [ ] Add JSDoc comments for public APIs

## Benefits

1. **Maintainability** - Smaller, focused files are easier to understand
2. **Testability** - Utilities and hooks can be tested independently
3. **Reusability** - Extracted utilities can be used elsewhere
4. **Performance** - Better code splitting and memoization opportunities
5. **Developer Experience** - Easier to navigate and modify

## Migration Path

1. Start with utilities (non-breaking)
2. Gradually extract hooks (minimal changes to component)
3. Extract components one at a time
4. Update imports incrementally
5. Remove old code after verification



