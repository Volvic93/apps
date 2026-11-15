import UIKit

/// Einfache Ansicht für das Übertragungs-Protokoll (Text aus `CastManager.shared.logText`).
final class CastLogViewController: UIViewController {
    private let textView = UITextView()

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Übertragungs-Protokoll"
        view.backgroundColor = .systemBackground

        textView.isEditable = false
        textView.alwaysBounceVertical = true
        textView.font = UIFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        textView.backgroundColor = .systemBackground
        textView.textColor = .label
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)
        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: guide.topAnchor),
            textView.bottomAnchor.constraint(equalTo: guide.bottomAnchor),
            textView.leadingAnchor.constraint(equalTo: guide.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: guide.trailingAnchor)
        ])

        navigationItem.rightBarButtonItems = [
            UIBarButtonItem(title: "Leeren", style: .plain, target: self, action: #selector(clearTapped)),
            UIBarButtonItem(title: "Kopieren", style: .plain, target: self, action: #selector(copyTapped))
        ]
        reload()
    }

    private func reload() {
        let text = CastManager.shared.logText
        textView.text = text.isEmpty ? "(Noch keine Einträge.)" : text
    }

    @objc private func copyTapped() {
        UIPasteboard.general.string = CastManager.shared.logText
    }

    @objc private func clearTapped() {
        CastManager.shared.clearLog()
        reload()
    }
}
