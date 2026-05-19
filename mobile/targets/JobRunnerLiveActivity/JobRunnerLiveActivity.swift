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
    static let cardBackground = Color(red: 0.11, green: 0.11, blue: 0.12)     // #1C1C1E
}

struct JobRunnerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: JobRunnerLiveActivityAttributes.self) { context in
            // Lock-screen / Notification-center presentation. The system
            // wraps this in a rounded bubble whose fill we set via
            // `activityBackgroundTint` — we go dark to match the MLB / Uber
            // premium aesthetic, with the inner view supplying the layout.
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.cardBackground)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandBadge()
                        .frame(width: 36, height: 36)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(context.attributes.startedAt, style: .timer)
                            .font(.system(size: 16, weight: .bold, design: .rounded).monospacedDigit())
                            .foregroundStyle(Color.jobRunnerOrange)
                            .frame(maxWidth: 90, alignment: .trailing)
                        Text("ELAPSED")
                            .font(.system(size: 8, weight: .semibold))
                            .tracking(1.0)
                            .foregroundStyle(.white.opacity(0.4))
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(primaryAddressLine(context.attributes.address))
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        Text(context.attributes.customerName)
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.6))
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        StatusPill(status: context.state.status)
                        Spacer()
                    }
                }
            } compactLeading: {
                BrandBadge()
                    .frame(width: 20, height: 20)
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.jobRunnerOrange)
                    .frame(maxWidth: 52)
            } minimal: {
                BrandBadge()
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
        HStack(alignment: .top, spacing: 14) {
            // Logo badge with a brand-blue glow — gives the card a focal
            // point against the dark background and reads as "JobRunner"
            // at a glance from the lock screen.
            BrandBadge()
                .frame(width: 46, height: 46)
                .shadow(color: Color.jobRunnerBlue.opacity(0.45), radius: 10, x: 0, y: 0)

            VStack(alignment: .leading, spacing: 5) {
                // Address as headline — that's the question someone asks
                // when they glance at the card: "where am I working?"
                Text(primaryAddressLine(attributes.address))
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                // Secondary: customer name in muted white. If empty (older
                // payload) we still get a tidy two-line stack.
                if !attributes.customerName.isEmpty {
                    Text(attributes.customerName)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.6))
                        .lineLimit(1)
                }

                StatusPill(status: state.status)
                    .padding(.top, 2)
            }

            Spacer(minLength: 8)

            // Timer pinned top-right — the second-most important number on
            // the card after "where". Brand orange so it pops against the
            // dark surface.
            VStack(alignment: .trailing, spacing: 2) {
                Text(attributes.startedAt, style: .timer)
                    .font(.system(size: 22, weight: .heavy, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.jobRunnerOrange)
                    .frame(maxWidth: 96, alignment: .trailing)
                    .lineLimit(1)
                Text("ELAPSED")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(.white.opacity(0.45))
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}

// MARK: - Shared bits

// Most jobs sit at addresses like "26 Ocean Drive, Gordonvale QLD 4865".
// The first segment alone is more legible on a narrow card — the suburb +
// postcode just becomes noise at 14pt. Falls back gracefully if there's
// no comma to split on.
private func primaryAddressLine(_ address: String) -> String {
    if let comma = address.firstIndex(of: ",") {
        return String(address[..<comma]).trimmingCharacters(in: .whitespaces)
    }
    return address
}

private struct BrandBadge: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Color.white)
            Image("JobRunnerLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .padding(4)
        }
    }
}

private struct StatusPill: View {
    let status: JobStatus

    var body: some View {
        HStack(spacing: 6) {
            // Live status dot. For in-progress we breathe with a subtle
            // opacity animation so the card visibly feels "live" even when
            // the timer is the only number ticking.
            Circle()
                .fill(accentColor)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 10, weight: .heavy))
                .tracking(1.0)
                .foregroundStyle(accentColor)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(
            Capsule()
                .fill(accentColor.opacity(0.18))
        )
        .overlay(
            Capsule()
                .stroke(accentColor.opacity(0.35), lineWidth: 0.5)
        )
    }

    private var label: String {
        switch status {
        case .inProgress: return "IN PROGRESS"
        case .onBreak:    return "ON BREAK"
        case .completed:  return "COMPLETED"
        }
    }

    private var accentColor: Color {
        switch status {
        case .inProgress: return .jobRunnerBlue
        case .onBreak:    return .jobRunnerOrange
        case .completed:  return .jobRunnerGreen
        }
    }
}
