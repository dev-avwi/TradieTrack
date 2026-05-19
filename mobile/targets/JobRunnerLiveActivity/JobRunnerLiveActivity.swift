import ActivityKit
import SwiftUI
import WidgetKit

// JobRunner brand palette. Kept inline rather than pulled from an asset
// catalog to keep the extension target dependency-free — extensions can use
// the host app's asset catalog only via App Groups, which adds complexity
// we don't need for a handful of colors.
private extension Color {
    static let jobRunnerBlue = Color(red: 0.169, green: 0.490, blue: 0.914)   // #2B7DE9
    static let jobRunnerOrange = Color(red: 0.949, green: 0.549, blue: 0.157) // #F28C28
    static let jobRunnerGreen = Color(red: 0.20, green: 0.70, blue: 0.30)
    static let cardBackground = Color(red: 0.11, green: 0.11, blue: 0.12)     // #1C1C1E
    static let secondaryText = Color(red: 0.557, green: 0.557, blue: 0.576)   // #8E8E93
}

struct JobRunnerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: JobRunnerLiveActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.cardBackground)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    BrandBadge()
                        .frame(width: 38, height: 38)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerColumn(startedAt: context.attributes.startedAt, size: 16)
                }
                DynamicIslandExpandedRegion(.center) {
                    AddressBlock(address: context.attributes.address, primarySize: 14, secondarySize: 11)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        StatusPill(status: context.state.status)
                        if !context.attributes.customerName.isEmpty {
                            Text(context.attributes.customerName)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.white.opacity(0.55))
                                .lineLimit(1)
                        }
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
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
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
            BrandBadge()
                .frame(width: 48, height: 48)
                .shadow(color: Color.jobRunnerBlue.opacity(0.45), radius: 12, x: 0, y: 0)

            VStack(alignment: .leading, spacing: 6) {
                AddressBlock(address: attributes.address, primarySize: 17, secondarySize: 12)

                HStack(spacing: 8) {
                    StatusPill(status: state.status)
                    if !attributes.customerName.isEmpty {
                        Text(attributes.customerName)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.55))
                            .lineLimit(1)
                    }
                }
                .padding(.top, 2)
            }

            Spacer(minLength: 8)

            TimerColumn(startedAt: attributes.startedAt, size: 26)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
    }
}

// MARK: - Reusable bits

// Splits "26 Ocean Drive, Gordonvale QLD 4865" into a bold street headline
// and a muted suburb+postcode line below. Falls back to a single line if
// there's no comma. Two lines read better than one truncated address.
private struct AddressBlock: View {
    let address: String
    let primarySize: CGFloat
    let secondarySize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(streetLine)
                .font(.system(size: primarySize, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            if !suburbLine.isEmpty {
                Text(suburbLine)
                    .font(.system(size: secondarySize, weight: .medium))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
            }
        }
    }

    private var streetLine: String {
        guard let comma = address.firstIndex(of: ",") else { return address }
        return String(address[..<comma]).trimmingCharacters(in: .whitespaces)
    }

    private var suburbLine: String {
        guard let comma = address.firstIndex(of: ",") else { return "" }
        let after = address.index(after: comma)
        return String(address[after...]).trimmingCharacters(in: .whitespaces)
    }
}

// Big elapsed time + small-caps "ELAPSED" label stacked vertically.
// `minimumScaleFactor` is the fix for the "ELAPS / ED" wrap embarrassment —
// the timer scales down before it wraps. monospacedDigit() keeps the
// numbers from jittering as they tick.
private struct TimerColumn: View {
    let startedAt: Date
    let size: CGFloat

    var body: some View {
        VStack(alignment: .trailing, spacing: 1) {
            Text(startedAt, style: .timer)
                .font(.system(size: size, weight: .heavy, design: .rounded).monospacedDigit())
                .foregroundStyle(Color.jobRunnerOrange)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(maxWidth: max(size * 4, 80), alignment: .trailing)
            Text("ELAPSED")
                .font(.system(size: max(size * 0.36, 9), weight: .bold))
                .tracking(1.4)
                .foregroundStyle(.white.opacity(0.45))
        }
    }
}

// Logo badge with a guaranteed-readable fallback. If the asset catalog
// failed to bundle (the "gray box" failure mode), a styled blue circle with
// a white "J" shows instead — reads as intentional brand mark rather than
// broken UI. UIImage(named:) is the only way to do a presence check; SwiftUI's
// Image(_:) silently renders a placeholder when an asset is missing.
private struct BrandBadge: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                if UIImage(named: "JobRunnerLogo") != nil {
                    Circle().fill(Color.white)
                    Image("JobRunnerLogo")
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .padding(geo.size.width * 0.10)
                } else {
                    Circle().fill(Color.jobRunnerBlue)
                    Text("J")
                        .font(.system(size: geo.size.width * 0.55, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
    }
}

private struct StatusPill: View {
    let status: JobStatus

    var body: some View {
        HStack(spacing: 6) {
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
