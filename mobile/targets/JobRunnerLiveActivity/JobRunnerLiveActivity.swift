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
    static let tertiaryText = Color(red: 0.282, green: 0.282, blue: 0.290)    // #48484A
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
                        .frame(width: 36, height: 36)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerColumn(startedAt: context.attributes.startedAt, size: 18)
                }
                DynamicIslandExpandedRegion(.center) {
                    AddressBlock(
                        address: context.attributes.address,
                        customerName: context.attributes.customerName,
                        primarySize: 14,
                        secondarySize: 11
                    )
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        StatusRow(status: context.state.status, compact: true)
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
                    .frame(maxWidth: 56)
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
        VStack(spacing: 0) {
            // Top row: brand badge + small caption on the left,
            //          oversized elapsed timer on the right.
            HStack(alignment: .center, spacing: 12) {
                BrandBadge()
                    .frame(width: 38, height: 38)

                VStack(alignment: .leading, spacing: 1) {
                    Text("JobRunner")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("Live job")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.secondaryText)
                }

                Spacer()

                TimerColumn(startedAt: attributes.startedAt, size: 26)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)

            // Headline section: street name as the primary read, suburb
            // (and optional customer) as a single muted secondary line.
            AddressBlock(
                address: attributes.address,
                customerName: attributes.customerName,
                primarySize: 20,
                secondarySize: 13
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 18)
            .padding(.top, 10)
            .padding(.bottom, 14)

            // Hairline divider — separates content from the action row
            // and gives the card a structured "two-section" rhythm.
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 0.5)

            // Action row: live-status indicator on the left, navigation
            // affordance on the right. Tapping the card opens the host
            // app — system behavior; the chevron is just a visual cue.
            HStack {
                StatusRow(status: state.status, compact: false)
                Spacer()
                HStack(spacing: 3) {
                    Text("View job")
                        .font(.system(size: 14, weight: .medium))
                    Text("›")
                        .font(.system(size: 17, weight: .semibold))
                }
                .foregroundStyle(Color.secondaryText)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
        }
    }
}

// MARK: - Reusable bits

// Splits "26 Ocean Drive, Gordonvale QLD 4865" into a bold street headline
// and a muted "suburb · customer" line below. Falls back gracefully when
// either piece is missing.
private struct AddressBlock: View {
    let address: String
    let customerName: String
    let primarySize: CGFloat
    let secondarySize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(streetLine)
                .font(.system(size: primarySize, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            if !secondaryLine.isEmpty {
                Text(secondaryLine)
                    .font(.system(size: secondarySize))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
            }
        }
    }

    private var streetLine: String {
        guard let comma = address.firstIndex(of: ",") else { return address }
        return String(address[..<comma]).trimmingCharacters(in: .whitespaces)
    }

    private var secondaryLine: String {
        let suburb: String = {
            guard let comma = address.firstIndex(of: ",") else { return "" }
            return String(address[address.index(after: comma)...]).trimmingCharacters(in: .whitespaces)
        }()
        switch (suburb.isEmpty, customerName.isEmpty) {
        case (true,  true):  return ""
        case (false, true):  return suburb
        case (true,  false): return customerName
        case (false, false): return "\(suburb) · \(customerName)"
        }
    }
}

// Big elapsed time + small-caps "ELAPSED" label, vertically stacked. The
// label has `.fixedSize()` so it never wraps regardless of the timer
// width above it — that's the fix for the previous "ELAPS / ED" bug.
// `minimumScaleFactor` keeps the timer on one line at any reasonable
// elapsed duration.
private struct TimerColumn: View {
    let startedAt: Date
    let size: CGFloat

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(startedAt, style: .timer)
                .font(.system(size: size, weight: .bold, design: .rounded).monospacedDigit())
                .foregroundStyle(Color.jobRunnerOrange)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .fixedSize(horizontal: true, vertical: false)
            Text("ELAPSED")
                .font(.system(size: max(size * 0.36, 10), weight: .medium))
                .tracking(0.8)
                .foregroundStyle(Color.tertiaryText)
                .fixedSize()
        }
    }
}

// Squircle logo badge with a guaranteed-readable fallback. We use the
// UIImage presence check + `.renderingMode(.original)` together because:
//   1. UIImage(named:) gives us a hard "does it exist?" boolean — Image()
//      silently renders a placeholder, which is what we used to see.
//   2. .renderingMode(.original) prevents iOS's lock-screen "vibrancy"
//      pipeline from coercing the colored logo into a monochrome
//      template (which is what made it look like a gray silhouette).
// If the asset somehow still fails to load, the fallback is a JobRunner-
// blue squircle with a heavy white "J" — reads as intentional brand mark,
// not as a broken UI placeholder.
private struct BrandBadge: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                let cornerRadius = geo.size.width * 0.22 // ~iOS squircle ratio
                if let uiImage = UIImage(named: "JobRunnerLogo") {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color.white)
                    Image(uiImage: uiImage)
                        .renderingMode(.original)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .padding(geo.size.width * 0.10)
                } else {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(Color.jobRunnerBlue)
                    Text("J")
                        .font(.system(size: geo.size.width * 0.55, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
    }
}

// Live status indicator: colored dot + plain-language status label.
// The full "Job in progress" / "On break" / "Job completed" reads more
// like a card line item than a badge, matching the DoorDash action-row
// feel rather than the previous IN-PROGRESS-style screaming pill.
private struct StatusRow: View {
    let status: JobStatus
    let compact: Bool

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(accentColor)
                .frame(width: compact ? 6 : 7, height: compact ? 6 : 7)
            Text(label)
                .font(.system(size: compact ? 12 : 14, weight: .medium))
                .foregroundStyle(Color.white.opacity(0.92))
                .lineLimit(1)
        }
    }

    private var label: String {
        switch status {
        case .inProgress: return "Job in progress"
        case .onBreak:    return "On break"
        case .completed:  return "Job completed"
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
