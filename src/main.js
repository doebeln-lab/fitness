const scripts = [
  {
    name: 'BRPlayerController.cs',
    tag: 'Spielerbewegung',
    description: 'Third-Person-Grundbewegung mit Sprinten, Springen und Ducken über CharacterController.',
    code: `using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class BRPlayerController : MonoBehaviour
{
    [SerializeField] private Transform cameraRoot;
    [SerializeField] private float walkSpeed = 5f;
    [SerializeField] private float sprintSpeed = 8f;
    [SerializeField] private float crouchSpeed = 2.5f;
    [SerializeField] private float jumpHeight = 1.4f;
    [SerializeField] private float gravity = -20f;
    [SerializeField] private float turnSmoothTime = 0.08f;

    private CharacterController controller;
    private Vector3 verticalVelocity;
    private float turnSmoothVelocity;
    private bool isCrouching;

    private void Awake() => controller = GetComponent<CharacterController>();

    private void Update()
    {
        isCrouching = Input.GetKey(KeyCode.LeftControl);
        Move();
        JumpAndGravity();
    }

    private void Move()
    {
        float horizontal = Input.GetAxisRaw("Horizontal");
        float vertical = Input.GetAxisRaw("Vertical");
        Vector3 input = new Vector3(horizontal, 0f, vertical).normalized;

        if (input.magnitude < 0.1f) return;

        float targetAngle = Mathf.Atan2(input.x, input.z) * Mathf.Rad2Deg + cameraRoot.eulerAngles.y;
        float angle = Mathf.SmoothDampAngle(transform.eulerAngles.y, targetAngle, ref turnSmoothVelocity, turnSmoothTime);
        transform.rotation = Quaternion.Euler(0f, angle, 0f);

        Vector3 moveDirection = Quaternion.Euler(0f, targetAngle, 0f) * Vector3.forward;
        float speed = isCrouching ? crouchSpeed : Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : walkSpeed;
        controller.Move(moveDirection.normalized * speed * Time.deltaTime);
    }

    private void JumpAndGravity()
    {
        if (controller.isGrounded && verticalVelocity.y < 0f)
            verticalVelocity.y = -2f;

        if (controller.isGrounded && Input.GetButtonDown("Jump") && !isCrouching)
            verticalVelocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);

        verticalVelocity.y += gravity * Time.deltaTime;
        controller.Move(verticalVelocity * Time.deltaTime);
    }
}`,
  },
  {
    name: 'BuildPiece.cs',
    tag: 'Struktur',
    description: 'Zerstörbare Bauteile mit Health-Points für Wand, Rampe, Boden und Dach.',
    code: `using UnityEngine;

public enum BuildPieceType { Wall, Ramp, Floor, Roof }

public class BuildPiece : MonoBehaviour
{
    [SerializeField] private BuildPieceType pieceType = BuildPieceType.Wall;
    [SerializeField] private int maxHealth = 150;

    public BuildPieceType PieceType => pieceType;
    public int CurrentHealth { get; private set; }

    private void Awake() => CurrentHealth = maxHealth;

    public void ApplyDamage(int amount)
    {
        CurrentHealth = Mathf.Max(0, CurrentHealth - amount);
        if (CurrentHealth == 0)
            Destroy(gameObject);
    }
}`,
  },
  {
    name: 'BuildingSystem.cs',
    tag: 'Bausystem',
    description: 'Wandvorschau mit Grid-Snapping, Kollisionsprüfung und Platzierung per linker Maustaste.',
    code: `using UnityEngine;

public class BuildingSystem : MonoBehaviour
{
    [SerializeField] private Camera playerCamera;
    [SerializeField] private GameObject wallPrefab;
    [SerializeField] private GameObject wallPreviewPrefab;
    [SerializeField] private LayerMask buildBlockers;
    [SerializeField] private float buildRange = 7f;
    [SerializeField] private float gridSize = 2f;

    private GameObject preview;
    private bool buildMode;

    private void Start()
    {
        preview = Instantiate(wallPreviewPrefab);
        preview.SetActive(false);
    }

    private void Update()
    {
        if (Input.GetKeyDown(KeyCode.B))
            buildMode = !buildMode;

        preview.SetActive(buildMode);
        if (!buildMode) return;

        Vector3 targetPosition = GetSnappedBuildPosition();
        Quaternion targetRotation = Quaternion.Euler(0f, Mathf.Round(transform.eulerAngles.y / 90f) * 90f, 0f);
        preview.transform.SetPositionAndRotation(targetPosition, targetRotation);

        bool canPlace = !Physics.CheckBox(targetPosition, new Vector3(0.9f, 1.5f, 0.15f), targetRotation, buildBlockers);
        SetPreviewColor(canPlace ? Color.green : Color.red);

        if (canPlace && Input.GetMouseButtonDown(0))
            Instantiate(wallPrefab, targetPosition, targetRotation);
    }

    private Vector3 GetSnappedBuildPosition()
    {
        Vector3 rawPosition = playerCamera.transform.position + playerCamera.transform.forward * buildRange;
        return new Vector3(
            Mathf.Round(rawPosition.x / gridSize) * gridSize,
            Mathf.Round(rawPosition.y / gridSize) * gridSize,
            Mathf.Round(rawPosition.z / gridSize) * gridSize);
    }

    private void SetPreviewColor(Color color)
    {
        foreach (Renderer renderer in preview.GetComponentsInChildren<Renderer>())
            renderer.material.color = new Color(color.r, color.g, color.b, 0.45f);
    }
}`,
  },
];

const milestones = [
  'Unity 2022 LTS oder neuer mit URP-Template erstellen.',
  'Third-Person-Kapsel mit CharacterController, Main Camera und CameraRig anlegen.',
  'WallPrefab und WallPreviewPrefab als eigene graue Blockout-Assets erstellen.',
  'BRPlayerController und BuildingSystem auf den Spieler legen und Referenzen verbinden.',
  'Play drücken: WASD bewegen, Shift sprinten, Space springen, Strg ducken, B toggelt Bau-Modus, Linksklick platziert eine Wand.',
];

const nextSteps = [
  'Inventar-Slots und Ressourcenwerte für Holz/Stein/Metall ergänzen.',
  'Loot-Daten als ScriptableObjects modellieren und Spawnpunkte in der Arena verteilen.',
  'Health/Shield-Komponenten mit Treffererkennung verbinden.',
  'Schrumpfende Sicherheitszone mit UI-Timer als nächsten Meilenstein implementieren.',
];

function render() {
  document.querySelector('#root').innerHTML = `<main>
    <section class="hero">
      <nav><div class="brand"><span>◇</span> Stormforge Arena</div><a href="#milestone">Meilenstein 1</a></nav>
      <div class="heroGrid">
        <div>
          <p class="eyebrow">Eigenständiger Unity-Prototyp · URP · Third-Person</p>
          <h1>Grundgerüst für ein originales Battle-Royale-Projekt.</h1>
          <p class="lead">Dieses Starterpaket nutzt keine fremden Marken, Figuren, Logos oder Skins. Es fokussiert den ersten spielbaren Meilenstein: Spielerbewegung plus ein einfaches Bausystem zum Platzieren einer Wand.</p>
          <a class="cta" href="#scripts">C#-Scripts ansehen</a>
        </div>
        <div class="prototypeCard">
          <span class="badge">Milestone 01</span>
          <h2>Player + Wall Build</h2>
          <p>Bewegen, sprinten, springen, ducken, Baumodus toggeln und eine gesnappte Wand platzieren.</p>
        </div>
      </div>
    </section>

    <section id="milestone" class="panel twoCols">
      <div>
        <p class="eyebrow">Setup-Schritte</p>
        <h2>So setzt du den ersten Prototyp in Unity auf</h2>
        <p>Nutze simple Platzhalter-Geometrie und eigene Namen, damit das Projekt von Anfang an klar als eigenständige Marke aufgebaut ist.</p>
      </div>
      <ol class="steps">${milestones.map((step) => `<li>${step}</li>`).join('')}</ol>
    </section>

    <section id="scripts" class="scripts">
      ${scripts.map(scriptCard).join('')}
    </section>

    <section class="panel roadmap">
      <div>
        <p class="eyebrow">Danach</p>
        <h2>Nächste modulare Systeme</h2>
      </div>
      <div class="nextGrid">${nextSteps.map((step) => `<article>${step}</article>`).join('')}</div>
    </section>
  </main>`;
}

function scriptCard(script) {
  return `<article class="scriptCard">
    <div class="scriptHeader"><span>${script.tag}</span><strong>${script.name}</strong></div>
    <p>${script.description}</p>
    <pre><code>${escapeHtml(script.code)}</code></pre>
  </article>`;
}

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

render();
