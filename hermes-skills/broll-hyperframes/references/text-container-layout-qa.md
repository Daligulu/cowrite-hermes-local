# Text Container Layout QA for B-roll / GSAP Videos

Use this reference when a rendered frame shows text that is not visually centered in its card, chip, pill, workflow node, speech bubble, status bar, or caption container.

## Trigger

Apply this before final render when:

- text sits near a container edge;
- a large line looks visually outside the card even if technically inside;
- chips are unevenly spaced or wrap unpredictably;
- a title is floating over a diagram instead of living in a clear container;
- a video-player overlay, play button, or platform UI would cover the most important text;
- the user flags screenshots where text and frame/container alignment looks wrong.

## Rules

1. **Every important phrase needs a container contract.** Define width, height, padding, line-height, text-align, and vertical alignment. Do not rely on default inline flow.
2. **Use flex centering for nodes and pills.** Workflow nodes, badges, CTA buttons, and one-line pills should use `display:flex; align-items:center; justify-content:center; line-height:1.1-1.2`.
3. **Long statements belong in their own card.** If a sentence is a conclusion, do not leave it as free-floating text under a diagram. Put it in a card/status bar with explicit padding and centered text.
4. **Avoid mixed inline chips for dense lists.** Use CSS grid for chips, e.g. `grid-template-columns:1fr 1fr`, with a full-width final row for the key item.
5. **Balance card occupancy.** Aim for text and objects to occupy about 55-75% of a card's usable area. Too sparse looks unfinished; too tight looks broken.
6. **Protect center-demo legibility.** Main B-roll/demo labels in the central motion area should generally be at least 38-42px on a 1080×1920 canvas. Small helper text can be smaller, but core objects such as workflow nodes, funnel inputs/outputs, question tiles, and status bars must be readable on a phone screenshot.
7. **Use controlled line breaks.** For Chinese titles inside circles/cards, explicitly break lines and reduce font size instead of letting one long line overflow or crowd the border.
7. **Reserve platform-overlay-safe centers.** In mobile preview frames, the video play button often covers the exact center. Do not put the only critical word directly under the expected play button; use a status bar, move the text slightly up/down, or duplicate meaning in a caption/card.
8. **Presenter/caption collision rule.** If Feng appears bottom-right, captions stay bottom-left and should end before the character region. Prefer reducing caption width over shrinking the character into illegibility.
9. **Inspect actual frames, not just HTML.** Contact sheets can reveal text that looked fine in DOM but feels off under video-player UI.

## Reusable CSS patterns

### Centered card

```css
.layout-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
```

### Workflow node

```css
.flow-step {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.15;
  padding: 0;
}
```

### Pill stack

```css
.pill-stack {
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: flex-start;
}
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 128px;
  height: 58px;
  padding: 0 24px;
  border-radius: 18px;
  line-height: 1.2;
}
```

### Chip grid

```css
.chip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.chip-grid .chip {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 58px;
  margin: 0;
  white-space: nowrap;
}
.chip-grid .wide {
  grid-column: 1 / 3;
}
```

### Approval/status lockup

```css
.approval-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-radius: 32px;
  line-height: 1.08;
}
```

## Frame-specific lessons from grill-with-docs video

- Hook circle: do not put a long Chinese sentence in one line inside a circle. Use a smaller two-line subtitle and centered cards below.
- Prompt-to-Brief: `目标 / 边界 / 取舍 / 规则` works better as a vertical pill stack than loose inline chips.
- X approval flow: put `Approve 才能发布` inside an explicit centered status container, not just absolute text inside the large white workflow card.
- Content rules: five chips should use a 2-column grid with a full-width final row for the key constraint.
- Questioning vs role-play: large concepts like `目标 / 边界 / 取舍` should be contained in equal pills so the right-hand card does not feel like loose text.

## Verification checklist

Before final delivery:

- [ ] Extract contact sheet from the actual rendered MP4 or browser frame captures.
- [ ] Check hero, workflow, table, chip, and CTA frames at mobile size.
- [ ] Confirm every card/node/pill has text visually centered both horizontally and vertically.
- [ ] Confirm text does not touch rounded corners, borders, arrows, or badges.
- [ ] Confirm platform play/progress overlays do not obscure the only critical message.
- [ ] Confirm captions do not collide with the Feng presenter.
- [ ] If the user flags screenshots, fix the source layout and re-render; do not only explain the issue.
