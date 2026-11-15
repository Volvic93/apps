import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var browser: BrowserViewController?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let controller = BrowserViewController()
        browser = controller

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = Theme.background
        window.overrideUserInterfaceStyle = AppSettings.shared.interfaceStyle
        window.rootViewController = controller
        window.makeKeyAndVisible()
        self.window = window

        AudioSessionManager.shared.start()
        return true
    }

    /// URL-Schema: flimmerfrei://open?url=<kodierte YouTube-Adresse>
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard let controller = browser else { return false }
        return controller.handleIncomingURL(url)
    }
}
