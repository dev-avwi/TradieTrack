import ActivityKit
import SwiftUI
import WidgetKit

// JobRunner brand palette. Kept inline so the extension target stays
// dependency-free (extensions can only reach the host app's asset
// catalog via App Groups, which is overkill for a handful of colors).
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
                        .frame(width: 40, height: 40)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerColumn(startedAt: context.attributes.startedAt, size: 18)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(AddressParts(address: context.attributes.address).street)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                        StatusLine(
                            status: context.state.status,
                            customerName: context.attributes.customerName,
                            size: 11
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                // The compact slot is ~22pt wide — too small to render a
                // brand mark legibly. Apple's own compact islands show
                // dynamic state (waveform, arrow, etc.), not branding.
                // A status-coloured dot reads as "the job is live" and
                // shifts meaning with the activity state (blue / orange
                // / green). Subtle blue glow to break the flat-disc look.
                StatusDot(status: context.state.status, size: 14)
                    .padding(.leading, 2)
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(Color.jobRunnerOrange)
                    .frame(maxWidth: 56)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.trailing, 2)
            } minimal: {
                // Minimal is even tinier (~10pt) — same rule: status dot,
                // not branding. Filling the available square via
                // GeometryReader keeps it crisp at any size.
                StatusDot(status: context.state.status)
            }
            .keylineTint(Color.jobRunnerBlue)
        }
    }
}

// MARK: - Lock-screen view

// Single-row layout: 48pt brand badge on the left, three-line content
// column in the middle, oversized timer column on the right. No brand
// label, no divider, no faux "View job" affordance — every pixel earns
// its keep. Vertical breathing is a uniform 14pt; horizontal is 16pt
// (Apple's default card inset) — no padding zoo.
private struct LockScreenView: View {
    let attributes: JobRunnerLiveActivityAttributes
    let state: JobRunnerLiveActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            BrandBadge()
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 4) {
                Text(AddressParts(address: attributes.address).street)
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)

                Text(AddressParts(address: attributes.address).suburbOrFallback)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)

                StatusLine(
                    status: state.status,
                    customerName: attributes.customerName,
                    size: 13
                )
                .padding(.top, 1)
            }

            Spacer(minLength: 8)

            TimerColumn(startedAt: attributes.startedAt, size: 26)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

// MARK: - Address parsing

// Splits "26 Ocean Drive, Gordonvale QLD 4865" into a bold street headline
// and a muted suburb/postcode line. Robust to addresses without commas
// (rare for AU but worth handling): when there's no comma, the second
// line falls back to "Active job" so the card never collapses to one
// short line — the suburb slot always has *something* legible there.
private struct AddressParts {
    let address: String

    var street: String {
        guard let comma = address.firstIndex(of: ",") else { return address }
        return String(address[..<comma]).trimmingCharacters(in: .whitespaces)
    }

    var suburbOrFallback: String {
        guard let comma = address.firstIndex(of: ",") else { return "Active job" }
        let after = address.index(after: comma)
        let s = String(address[after...]).trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? "Active job" : s
    }
}

// MARK: - Status + customer line

// One row, both pieces of context combined: live-status dot + colored
// label, then a hairline interpunct, then the customer name in muted
// gray. Folds the previous "action row" content back into the main
// content column so it doesn't need its own divider'd section.
private struct StatusLine: View {
    let status: JobStatus
    let customerName: String
    let size: CGFloat

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(accentColor)
                .frame(width: size * 0.46, height: size * 0.46)
            Text(label)
                .font(.system(size: size, weight: .semibold))
                .foregroundStyle(accentColor)
                .lineLimit(1)
            if !customerName.isEmpty {
                Text("·")
                    .font(.system(size: size, weight: .medium))
                    .foregroundStyle(Color.tertiaryText)
                Text(customerName)
                    .font(.system(size: size))
                    .foregroundStyle(Color.secondaryText)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
    }

    private var label: String {
        switch status {
        case .inProgress: return "In progress"
        case .onBreak:    return "On break"
        case .completed:  return "Completed"
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

// MARK: - Timer column

// Big elapsed time + small caption stacked. The label is `.fixedSize()`
// so it can never wrap to "ELAPS / ED" regardless of timer width — the
// previous bug. `.minimumScaleFactor` keeps the timer on one line for any
// reasonable elapsed duration (hours+ render fine). "elapsed" is lower-
// case because uppercase tracking at this size reads shouty for a label
// the eye treats as ancillary.
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
            Text("elapsed")
                .font(.system(size: max(size * 0.38, 10), weight: .medium))
                .foregroundStyle(Color.tertiaryText)
                .fixedSize()
        }
    }
}

// MARK: - Brand badge

// Squircle logo badge that fills edge-to-edge — no internal padding ring.
// The PNG's own whitespace already provides a small inset; double-padding
// it made the runner figure feel orbital in earlier passes.
//
// Two real defenses against the "gray box" failure mode:
//   1. UIImage(named:) presence check: gives a hard yes/no, where
//      Image(_:) silently renders a placeholder if the asset's missing.
//   2. .renderingMode(.original): opts the image out of iOS's Live
//      Activity vibrancy pipeline, which would otherwise coerce coloured
//      brand artwork into a monochrome silhouette on the lock screen.
// Fallback: JobRunner-blue squircle with a heavy white "J" — reads as
// brand mark, not as broken UI.
private struct BrandBadge: View {
    var body: some View {
        GeometryReader { geo in
            ZStack {
                let cornerRadius = geo.size.width * 0.225 // iOS app-icon squircle ratio
                let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

                if let uiImage = UIImage(named: "JobRunnerLogo") {
                    shape.fill(Color.white)
                    Image(uiImage: uiImage)
                        .renderingMode(.original)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .clipShape(shape)
                } else {
                    shape.fill(Color.jobRunnerBlue)
                    Text("J")
                        .font(.system(size: geo.size.width * 0.55, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
            }
        }
    }
}

// MARK: - Status dot (Dynamic Island compact/minimal)

// A simple status-coloured circle with a soft glow ring. Used in the
// Dynamic Island compact + minimal slots where a logo can't render
// legibly. Fills the available square via GeometryReader when no fixed
// size is provided (minimal mode), or honours an explicit size param.
private struct StatusDot: View {
    let status: JobStatus
    var size: CGFloat? = nil

    var body: some View {
        if let size = size {
            dot.frame(width: size, height: size)
        } else {
            GeometryReader { geo in
                dot.frame(width: geo.size.width, height: geo.size.height)
            }
        }
    }

    private var dot: some View {
        Circle()
            .fill(accentColor)
            .overlay(
                Circle()
                    .stroke(accentColor.opacity(0.35), lineWidth: 2)
                    .blur(radius: 1.5)
                    .scaleEffect(1.3)
            )
    }

    private var accentColor: Color {
        switch status {
        case .inProgress: return .jobRunnerBlue
        case .onBreak:    return .jobRunnerOrange
        case .completed:  return .jobRunnerGreen
        }
    }
}
