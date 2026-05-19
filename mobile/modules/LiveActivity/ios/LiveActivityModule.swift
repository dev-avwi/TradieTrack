import ActivityKit
import ExpoModulesCore
import Foundation

// LiveActivityModule
// ------------------
// Bridges ActivityKit to the JS layer. Owns at most one in-flight
// Activity<JobRunnerLiveActivityAttributes> at a time; starting a new job
// retires the previous one, so JS callers don't need to track activity IDs.
//
// v1 is local-update only — pushType is nil and APNs is not wired up. The
// extension target does not need to change to add APNs later; only this
// module's start() and the server side.
//
// Note on availability: the host app's deployment target is iOS 16.0, but
// ActivityKit requires 16.1 and the `Activity.request(attributes:content:)`
// signature requires 16.2. The Module class itself can't be marked
// @available — Expo's module registry instantiates it unconditionally at
// launch — so `currentActivity` is type-erased to `Any?` and re-cast inside
// @available blocks at each call site.
public class LiveActivityModule: Module {
    private var currentActivity: Any?

    public func definition() -> ModuleDefinition {
        Name("LiveActivity")

        OnCreate {
            // Reattach to an in-flight activity from a prior app session so
            // update()/end() can target it without JS knowing its ID. The
            // OS keeps activities alive across app launches up to 8h or
            // their staleDate, whichever comes first.
            if #available(iOS 16.2, *) {
                self.currentActivity = Activity<JobRunnerLiveActivityAttributes>.activities.first
            }
        }

        AsyncFunction("areActivitiesEnabled") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        AsyncFunction("start") { (job: JobPayload) async throws -> String in
            guard #available(iOS 16.2, *) else {
                throw UnsupportedOSException()
            }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                throw NotAuthorizedException()
            }

            // One activity at a time — end the previous before starting the
            // new one. .immediate so the old one disappears instantly rather
            // than lingering next to the new one.
            if let existing = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> {
                await existing.end(nil, dismissalPolicy: .immediate)
                self.currentActivity = nil
            }

            let attributes = JobRunnerLiveActivityAttributes(
                jobId: job.id,
                address: job.address,
                customerName: job.clientName,
                startedAt: Date()
            )
            let initialState = JobRunnerLiveActivityAttributes.ContentState(status: .inProgress)

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: initialState, staleDate: nil),
                    pushType: nil
                )
                self.currentActivity = activity
                return activity.id
            } catch {
                throw StartFailedException(error.localizedDescription)
            }
        }

        AsyncFunction("update") { (status: String) async throws in
            guard #available(iOS 16.2, *) else {
                throw UnsupportedOSException()
            }
            guard let activity = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> else {
                throw NoActiveActivityException()
            }
            guard let jobStatus = JobStatus(rawValue: status) else {
                throw InvalidStatusException(status)
            }

            let newState = JobRunnerLiveActivityAttributes.ContentState(status: jobStatus)
            await activity.update(.init(state: newState, staleDate: nil))
        }

        AsyncFunction("end") { () async in
            guard #available(iOS 16.2, *) else { return }
            guard let activity = self.currentActivity as? Activity<JobRunnerLiveActivityAttributes> else {
                return
            }

            // Final state is "completed". The lock-screen card sticks around
            // for 30 minutes so users can see the result of the job they
            // just wrapped, then the system clears it. The four-hour
            // ActivityKit ceiling still applies — `.after` is just a hint.
            let finalState = JobRunnerLiveActivityAttributes.ContentState(status: .completed)
            let dismissalDate = Date().addingTimeInterval(30 * 60)
            await activity.end(
                .init(state: finalState, staleDate: nil),
                dismissalPolicy: .after(dismissalDate)
            )
            self.currentActivity = nil
        }
    }
}

internal struct JobPayload: Record {
    @Field var id: String = ""
    @Field var address: String = ""
    @Field var clientName: String = ""
}

internal final class UnsupportedOSException: Exception {
    override var reason: String {
        "Live Activities require iOS 16.2 or later."
    }
}

internal final class NotAuthorizedException: Exception {
    override var reason: String {
        "Live Activities are disabled for this app in Settings."
    }
}

internal final class NoActiveActivityException: Exception {
    override var reason: String {
        "No Live Activity is currently running."
    }
}

internal final class StartFailedException: GenericException<String> {
    override var reason: String {
        "Failed to start Live Activity: \(param)"
    }
}

internal final class InvalidStatusException: GenericException<String> {
    override var reason: String {
        "Unknown job status: '\(param)'. Expected one of: in_progress, on_break, completed."
    }
}
