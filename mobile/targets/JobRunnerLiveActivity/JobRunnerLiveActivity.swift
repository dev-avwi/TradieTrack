import ActivityKit
import SwiftUI
import WidgetKit

// JobRunner brand palette. Kept inline rather than pulled from an asset
// catalog to keep the extension target dependency-free — extensions can use
// the host app's asset catalog only via App Groups, which adds complexity
// we don't need for two colors.
private extension Color {
    static let jobRunnerBlue = Color(red: 0.169, green: 0.490, blue: 0.914)   // #2B7DE9
    static let jobRunnerOrange = Color(red: 0.949, green: 0.549, blue: 0.157) // #F28C28
    static let jobRunnerGreen = Color(red: 0.20, green: 0.70, blue: 0.30)
}

struct JobRunnerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: JobRunnerLiveActivityAttributes.self) { context in
            // Lock-screen / Notification-center presentation.
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.05))
                .activitySystemActionForegroundColor(.primary)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded — shown when the user long-presses the Dynamic Island.
                DynamicIslandExpandedRegion(.leading) {
                    BrandMark()
                        .frame(width: 30, height: 30)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startedAt, style: .timer)
                        .font(.system(size: 14, weight: .semibold, design: .rounded).monospacedDigit())
                        .foregroundStyle(Color.jobRunnerOrange)
                        .frame(maxWidth: 80, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.attributes.customerName)
                            .font(.headline)
                            .lineLimit(1)
                        Text(context.attributes.address)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        StatusBadge(status: context.state.status)
                        Spacer()
                    }
                }
            } compactLeading: {
                BrandMark()
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .medium, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.jobRunnerOrange)
                    .frame(maxWidth: 50)
            } minimal: {
                // Shown when multiple activities are competing for Dynamic
                // Island space — must be a single tiny glyph.
                BrandMark()
            }
            .keylineTint(Color.jobRunnerBlue)
        }
    }
}

// MARK: - Lock-screen view

private struct LockScreenView: View {
    let attributes: JobRunnerLiveActivityAttributes
    let state: JobRunnerLiveActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 12) {
            // Material-backed brand mark. `.thinMaterial` gives a frosted
            // glass effect on iOS 16.1+ that approximates the Liquid Glass
            // aesthetic of the main app. On iOS 26+ this could be upgraded
            // to `.glassEffect(...)` behind an availability check — left as
            // a follow-up.
            ZStack {
                Circle()
                    .fill(.thinMaterial)
                Image(systemName: "wrench.and.screwdriver.fill")
                    .foregroundStyle(Color.jobRunnerBlue)
                    .font(.title3)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 3) {
                Text(attributes.customerName)
                    .font(.headline)
                    .lineLimit(1)
                Text(attributes.address)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    StatusBadge(status: state.status)
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text(attributes.startedAt, style: .relative)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(Color.jobRunnerOrange)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

// MARK: - Reusable bits

private struct BrandMark: View {
    var body: some View {
        Image(systemName: "wrench.and.screwdriver.fill")
            .foregroundStyle(Color.jobRunnerBlue)
    }
}

private struct StatusBadge: View {
    let status: JobStatus

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color, in: .capsule)
    }

    private var label: String {
        switch status {
        case .inProgress: return "IN PROGRESS"
        case .onBreak:    return "ON BREAK"
        case .completed:  return "COMPLETED"
        }
    }

    private var color: Color {
        switch status {
        case .inProgress: return .jobRunnerBlue
        case .onBreak:    return .jobRunnerOrange
        case .completed:  return .jobRunnerGreen
        }
    }
}
