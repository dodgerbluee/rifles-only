using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering.Universal;

/// <summary>
/// THROW AWAY after numbers are locked. Boots the doorway feel slice on Play.
/// Question: does hold-to-lean + lethal semi-auto feel like CoD1 rifles in THIS engine?
/// </summary>
public static class FeelboxBoot
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Start()
    {
        if (Object.FindAnyObjectByType<FeelboxPlayer>())
            return;

        foreach (var cam in Object.FindObjectsByType<Camera>(FindObjectsSortMode.None))
        {
            cam.enabled = false;
            var listener = cam.GetComponent<AudioListener>();
            if (listener)
                listener.enabled = false;
        }

        var root = new GameObject("Feelbox");
        FeelboxWorld.Build(root.transform);

        var playerGo = new GameObject("Player");
        playerGo.layer = 2; // Ignore Raycast — bullets and lean probes skip the player
        playerGo.transform.SetPositionAndRotation(new Vector3(-3.6f, 0f, 0f), Quaternion.Euler(0f, 90f, 0f));
        playerGo.AddComponent<CharacterController>();
        playerGo.AddComponent<FeelboxPlayer>();

        FeelboxDummy.Spawn(new Vector3(6.2f, 0f, 0f), "Dummy-Door");
        FeelboxDummy.Spawn(new Vector3(5.1f, 0f, 2.5f), "Dummy-Window");
        FeelboxDummy.Spawn(new Vector3(10.4f, 0f, -3.1f), "Dummy-Open");
    }
}

public static class FeelboxTune
{
    public static float WalkSpeed = 5.6f;
    public static float GroundAccel = 22f;
    public static float GroundFriction = 10f;
    public static float AirAccel = 5f;
    public static float JumpHeight = 1.05f;
    public static float AdsMoveScale = 0.62f;
    public static float EyeStand = 1.64f;
    public static float EyeCrouch = 1.10f;
    public static float LeanAngleDeg = 18f;
    public static float LeanOffset = 0.28f;
    public static float LeanInTime = 0.11f;
    public static float FovHip = 90f;
    public static float FovAds = 65f;
    public static float AdsMouseScale = 0.62f;
    public static float MouseSens = 0.15f;
    public static int DmgBody = 50;
    public static int DmgHead = 100;
    public static float FireInterval = 0.18f;
    public static float RecoilUp = 1.15f;
    public static float RecoilSide = 0.42f;
    public const int MagSize = 8;
    public const float ReloadTime = 1.45f;
}

public class FeelboxPlayer : MonoBehaviour
{
    public string LastHit = "—";
    public int Mag = FeelboxTune.MagSize;
    public float Reloading;
    public bool Crouch;
    public bool Ads;
    public float LeanNormalized;

    CharacterController _cc;
    Camera _cam;
    Transform _camT;
    Transform _gun;
    float _yaw;
    float _pitch;
    float _leanMeters;
    float _leanVel;
    float _camLean;
    float _camLeanVel;
    float _eye;
    float _fov;
    float _lastFire = -10f;
    float _vertVel;
    Vector3 _planarVel;
    float _bob;
    bool _grounded;
    float _hitFlash;
    string _hitFlashKind;
    float _punchP;
    float _punchY;
    float _punchRoll;
    float _punchPVel;
    float _punchYVel;
    float _punchRollVel;
    Vector3 _gunKick;
    Vector3 _gunKickRot;
    Vector3 _gunRestPos;
    Transform _muzzleFlash;
    Light _muzzleLight;
    float _muzzleUntil;
    AudioSource _audio;

    void Awake()
    {
        _cc = GetComponent<CharacterController>();
        _cc.height = 1.8f;
        _cc.radius = 0.32f;
        _cc.center = new Vector3(0f, 0.9f, 0f);
        _cc.slopeLimit = 50f;
        _cc.stepOffset = 0.25f;
        _cc.minMoveDistance = 0f;
        _cc.skinWidth = 0.04f;

        var camGo = new GameObject("Camera");
        _camT = camGo.transform;
        _camT.SetParent(transform, false);
        _cam = camGo.AddComponent<Camera>();
        camGo.AddComponent<AudioListener>();
        camGo.AddComponent<UniversalAdditionalCameraData>();
        camGo.tag = "MainCamera";
        _cam.nearClipPlane = 0.05f;
        _cam.farClipPlane = 80f;
        _fov = FeelboxTune.FovHip;
        _cam.fieldOfView = _fov;

        BuildRifle();
        FeelboxFx.Warm();

        _audio = camGo.AddComponent<AudioSource>();
        _audio.playOnAwake = false;
        _audio.spatialBlend = 0f;

        _yaw = transform.eulerAngles.y;
        _eye = FeelboxTune.EyeStand;
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void BuildRifle()
    {
        _gun = new GameObject("Gun").transform;
        _gun.SetParent(_camT, false);
        _gunRestPos = new Vector3(0.18f, -0.16f, 0.42f);
        _gun.localPosition = _gunRestPos;

        var steel = FeelboxFx.Lit(new Color(0.14f, 0.15f, 0.13f));
        var wood = FeelboxFx.Lit(new Color(0.28f, 0.18f, 0.10f));
        Part(_gun, "Receiver", new Vector3(0f, 0f, 0.02f), new Vector3(0.055f, 0.07f, 0.28f), steel);
        Part(_gun, "Barrel", new Vector3(0f, 0.012f, 0.28f), new Vector3(0.022f, 0.022f, 0.36f), steel);
        Part(_gun, "Stock", new Vector3(0f, -0.02f, -0.18f), new Vector3(0.045f, 0.085f, 0.18f), wood);
        Part(_gun, "Mag", new Vector3(0f, -0.055f, 0.02f), new Vector3(0.03f, 0.07f, 0.06f), steel);

        var flashGo = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        flashGo.name = "MuzzleFlash";
        Object.Destroy(flashGo.GetComponent<Collider>());
        _muzzleFlash = flashGo.transform;
        _muzzleFlash.SetParent(_gun, false);
        _muzzleFlash.localPosition = new Vector3(0f, 0.012f, 0.48f);
        _muzzleFlash.localScale = Vector3.one * 0.07f;
        flashGo.GetComponent<MeshRenderer>().sharedMaterial = FeelboxFx.Unlit(new Color(1f, 0.82f, 0.35f));
        flashGo.SetActive(false);

        var lightGo = new GameObject("MuzzleLight");
        lightGo.transform.SetParent(_gun, false);
        lightGo.transform.localPosition = new Vector3(0f, 0.012f, 0.48f);
        _muzzleLight = lightGo.AddComponent<Light>();
        _muzzleLight.type = LightType.Point;
        _muzzleLight.range = 4.5f;
        _muzzleLight.intensity = 0f;
        _muzzleLight.color = new Color(1f, 0.75f, 0.4f);
    }

    static void Part(Transform parent, string name, Vector3 pos, Vector3 scale, Material mat)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = name;
        Object.Destroy(go.GetComponent<Collider>());
        go.transform.SetParent(parent, false);
        go.transform.localPosition = pos;
        go.transform.localScale = scale;
        go.GetComponent<MeshRenderer>().sharedMaterial = mat;
    }

    void Update()
    {
        var kb = Keyboard.current;
        var mouse = Mouse.current;
        if (kb == null || mouse == null)
            return;

        if (kb.tabKey.wasPressedThisFrame)
        {
            var locked = Cursor.lockState != CursorLockMode.Locked;
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }

        if (Cursor.lockState == CursorLockMode.Locked)
        {
            var lookScale = (Ads ? FeelboxTune.AdsMouseScale : 1f) * FeelboxTune.MouseSens;
            _yaw += mouse.delta.x.ReadValue() * lookScale;
            _pitch -= mouse.delta.y.ReadValue() * lookScale;
            _pitch = Mathf.Clamp(_pitch, -85f, 85f);
        }

        transform.rotation = Quaternion.Euler(0f, _yaw, 0f);

        Crouch = kb.leftCtrlKey.isPressed || kb.cKey.isPressed;
        Ads = Cursor.lockState == CursorLockMode.Locked && mouse.rightButton.isPressed;

        var targetH = Crouch ? 1.25f : 1.8f;
        _cc.height = Mathf.MoveTowards(_cc.height, targetH, 8f * Time.deltaTime);

        var targetEye = Crouch ? FeelboxTune.EyeCrouch : FeelboxTune.EyeStand;
        _eye = Mathf.MoveTowards(_eye, targetEye, 6f * Time.deltaTime);

        ProbeGround();

        var speed = FeelboxTune.WalkSpeed * (Crouch ? 0.55f : 1f) * (Ads ? FeelboxTune.AdsMoveScale : 1f);
        var wish = Vector3.zero;
        if (kb.wKey.isPressed) wish += transform.forward;
        if (kb.sKey.isPressed) wish -= transform.forward;
        if (kb.dKey.isPressed) wish += transform.right;
        if (kb.aKey.isPressed) wish -= transform.right;
        wish.y = 0f;
        if (wish.sqrMagnitude > 1f)
            wish.Normalize();

        Accelerate(wish, speed);

        if (_grounded && kb.spaceKey.wasPressedThisFrame)
        {
            _vertVel = Mathf.Sqrt(2f * FeelboxTune.JumpHeight * 9.81f);
            _grounded = false;
        }
        else if (_grounded)
            _vertVel = -1.5f;
        else
            _vertVel += Physics.gravity.y * Time.deltaTime;

        var leanInput = 0f;
        if (kb.qKey.isPressed) leanInput -= 1f;
        if (kb.eKey.isPressed) leanInput += 1f;
        var desired = leanInput * FeelboxTune.LeanOffset;
        var allowed = AllowedLean(desired);
        var damp = Mathf.Max(0.04f, FeelboxTune.LeanInTime);
        var newLean = Mathf.SmoothDamp(_leanMeters, allowed, ref _leanVel, damp);
        _camLean = Mathf.SmoothDamp(_camLean, allowed, ref _camLeanVel, damp * 0.75f);
        LeanNormalized = FeelboxTune.LeanOffset > 0.001f ? _camLean / FeelboxTune.LeanOffset : 0f;
        var leanDelta = newLean - _leanMeters;
        _leanMeters = newLean;

        _cc.center = new Vector3(0f, _cc.height * 0.5f, 0f);

        var motion = _planarVel * Time.deltaTime + transform.right * leanDelta;
        motion.y = _vertVel * Time.deltaTime;
        if (_grounded && _vertVel <= 0f)
            motion.y -= 0.12f;
        var flags = _cc.Move(motion);
        if ((flags & CollisionFlags.Below) != 0 && _vertVel < 0f)
            _vertVel = -1.5f;

        var moving = _planarVel.magnitude;
        if (_grounded && moving > 0.4f)
            _bob += Time.deltaTime * moving * 1.35f;
        var bobAmt = _grounded ? Mathf.Clamp01(moving / Mathf.Max(0.1f, speed)) : 0f;
        var bobY = Mathf.Sin(_bob) * 0.012f * bobAmt;
        var bobX = Mathf.Cos(_bob * 0.5f) * 0.006f * bobAmt;

        _camT.localPosition = new Vector3((_camLean - _leanMeters) + bobX, _eye + bobY, 0f);
        _punchP = Mathf.SmoothDamp(_punchP, 0f, ref _punchPVel, 0.07f);
        _punchY = Mathf.SmoothDamp(_punchY, 0f, ref _punchYVel, 0.08f);
        _punchRoll = Mathf.SmoothDamp(_punchRoll, 0f, ref _punchRollVel, 0.09f);
        _camT.localRotation = Quaternion.Euler(
            _pitch - _punchP,
            _punchY,
            -LeanNormalized * FeelboxTune.LeanAngleDeg - _punchRoll);

        var fovTarget = Ads ? FeelboxTune.FovAds : FeelboxTune.FovHip;
        _fov = Mathf.Lerp(_fov, fovTarget, 1f - Mathf.Exp(-10f * Time.deltaTime));
        _cam.fieldOfView = _fov;

        _gunRestPos = Ads ? new Vector3(0.02f, -0.11f, 0.34f) : new Vector3(0.18f, -0.16f, 0.42f);
        _gunKick = Vector3.Lerp(_gunKick, Vector3.zero, 1f - Mathf.Exp(-16f * Time.deltaTime));
        _gunKickRot = Vector3.Lerp(_gunKickRot, Vector3.zero, 1f - Mathf.Exp(-14f * Time.deltaTime));
        _gun.localPosition = _gunRestPos + _gunKick;
        _gun.localRotation = Quaternion.Euler(_gunKickRot);

        if (_muzzleFlash && Time.time > _muzzleUntil)
        {
            _muzzleFlash.gameObject.SetActive(false);
            if (_muzzleLight)
                _muzzleLight.intensity = 0f;
        }

        if (Reloading > 0f)
        {
            Reloading -= Time.deltaTime;
            if (Reloading <= 0f)
            {
                Reloading = 0f;
                Mag = FeelboxTune.MagSize;
            }
        }

        if (kb.rKey.wasPressedThisFrame)
            StartReload();

        if (Cursor.lockState == CursorLockMode.Locked && mouse.leftButton.isPressed)
            Fire();

        _hitFlash = Mathf.Max(0f, _hitFlash - Time.deltaTime * 4f);
    }

    void ProbeGround()
    {
        if (_vertVel > 0.4f)
        {
            _grounded = false;
            return;
        }

        var origin = transform.position + Vector3.up * (_cc.radius + 0.06f);
        var hit = Physics.SphereCast(
            origin,
            _cc.radius * 0.9f,
            Vector3.down,
            out _,
            0.18f,
            Physics.DefaultRaycastLayers,
            QueryTriggerInteraction.Ignore);
        _grounded = _cc.isGrounded || hit;
    }

    void Accelerate(Vector3 wish, float maxSpeed)
    {
        if (wish.sqrMagnitude < 0.01f)
        {
            var drop = _grounded ? Mathf.Exp(-FeelboxTune.GroundFriction * Time.deltaTime) : 1f;
            _planarVel *= drop;
            if (_planarVel.magnitude < 0.05f)
                _planarVel = Vector3.zero;
            return;
        }

        var accel = _grounded ? FeelboxTune.GroundAccel : FeelboxTune.AirAccel;
        var target = wish * maxSpeed;
        _planarVel = Vector3.MoveTowards(_planarVel, target, accel * Time.deltaTime * maxSpeed);
        if (_planarVel.magnitude > maxSpeed)
            _planarVel = _planarVel.normalized * maxSpeed;
    }

    float AllowedLean(float desired)
    {
        if (LeanFits(desired))
            return desired;
        var lo = _leanMeters;
        var hi = desired;
        for (var i = 0; i < 8; i++)
        {
            var mid = (lo + hi) * 0.5f;
            if (LeanFits(mid))
                lo = mid;
            else
                hi = mid;
        }
        return lo;
    }

    bool LeanFits(float meters)
    {
        var origin = transform.position - transform.right * _leanMeters;
        var radius = _cc.radius * 0.92f;
        var bottom = origin + transform.right * meters + Vector3.up * (radius + 0.05f);
        var top = origin + transform.right * meters + Vector3.up * (_cc.height - radius);
        return !Physics.CheckCapsule(bottom, top, radius, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
    }

    void StartReload()
    {
        if (Reloading > 0f || Mag == FeelboxTune.MagSize)
            return;
        Reloading = FeelboxTune.ReloadTime;
    }

    void Fire()
    {
        if (Reloading > 0f)
            return;
        if (Time.time - _lastFire < FeelboxTune.FireInterval)
            return;
        _lastFire = Time.time;
        if (Mag <= 0)
        {
            StartReload();
            LastHit = "empty";
            FeelboxFx.Play(_audio, FeelboxFx.Dry);
            return;
        }

        Mag -= 1;
        Kick();

        var muzzle = _muzzleFlash ? _muzzleFlash.position : _camT.TransformPoint(new Vector3(0.18f, -0.16f, 0.7f));
        var ray = _cam.ViewportPointToRay(new Vector3(0.5f, 0.5f, 0f));
        if (Physics.Raycast(ray, out var hit, 80f, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore))
        {
            FeelboxFx.Tracer(muzzle, hit.point);
            var part = hit.collider.GetComponent<FeelboxHit>();
            if (part && part.Dummy)
            {
                var dmg = part.IsHead ? FeelboxTune.DmgHead : FeelboxTune.DmgBody;
                part.Dummy.ApplyDamage(dmg, ray.direction);
                FeelboxFx.Impact(hit, true, part.IsHead);
                LastHit = $"{(part.IsHead ? "HEAD" : "body")} {dmg}  {part.Dummy.name}  {part.Dummy.Hp}hp";
                _hitFlash = 1f;
                _hitFlashKind = part.IsHead || part.Dummy.Hp <= 0 ? "kill" : "hit";
                FeelboxFx.Play(_audio, part.IsHead ? FeelboxFx.Headshot : FeelboxFx.Flesh);
            }
            else
            {
                FeelboxFx.Impact(hit, false, false);
                LastHit = "world";
            }
        }
        else
        {
            FeelboxFx.Tracer(muzzle, ray.GetPoint(40f));
            LastHit = "miss";
        }

        if (Mag == 0)
            StartReload();
    }

    void Kick()
    {
        var ads = Ads ? 0.55f : 1f;
        var up = FeelboxTune.RecoilUp * ads;
        var side = Random.Range(-FeelboxTune.RecoilSide, FeelboxTune.RecoilSide) * ads;
        _pitch -= up * 0.55f;
        _yaw += side * 0.35f;
        _pitch = Mathf.Clamp(_pitch, -85f, 85f);
        _punchP += up;
        _punchY += side;
        _punchRoll += side * 1.4f;
        _gunKick += new Vector3(side * 0.01f, 0.018f, -0.07f);
        _gunKickRot += new Vector3(-7.5f * ads, side * 4f, side * 8f);
        _fov += Ads ? 1.4f : 2.6f;
        _cam.fieldOfView = _fov;

        if (_muzzleFlash)
        {
            _muzzleFlash.gameObject.SetActive(true);
            _muzzleFlash.localScale = Vector3.one * Random.Range(0.05f, 0.1f);
            _muzzleUntil = Time.time + 0.045f;
        }
        if (_muzzleLight)
            _muzzleLight.intensity = 5.5f;

        FeelboxFx.Play(_audio, FeelboxFx.Shot);
    }

    void OnGUI()
    {
        var style = new GUIStyle(GUI.skin.label)
        {
            fontSize = 14,
            normal = { textColor = Color.white }
        };
        var ammo = Reloading > 0f ? $"reload {Reloading:0.0}s" : $"{Mag}/{FeelboxTune.MagSize}";
        var text =
            $"stance  {(Crouch ? "crouch" : "stand")}   lean  {(LeanNormalized * FeelboxTune.LeanAngleDeg):0}°   ads  {(Ads ? "yes" : "no")}\n" +
            $"ammo    {ammo}\n" +
            $"last    {LastHit}\n" +
            $"WASD  Space jump  Ctrl crouch  Q/E lean  RMB ads  LMB fire  R reload  Tab cursor";
        GUI.Label(new Rect(16, Screen.height - 100, 720, 100), text, style);

        var cx = Screen.width * 0.5f;
        var cy = Screen.height * 0.5f;
        GUI.color = new Color(1f, 1f, 1f, 0.9f);
        GUI.DrawTexture(new Rect(cx - 1, cy - 10, 2, 7), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(cx - 1, cy + 3, 2, 7), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(cx - 10, cy - 1, 7, 2), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(cx + 3, cy - 1, 7, 2), Texture2D.whiteTexture);
        if (_hitFlash > 0f)
        {
            GUI.color = _hitFlashKind == "kill" ? new Color(0.85f, 0.12f, 0.12f, _hitFlash) : new Color(1f, 1f, 1f, _hitFlash);
            GUI.DrawTexture(new Rect(cx - 11, cy - 11, 22, 3), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(cx - 11, cy + 8, 22, 3), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(cx - 11, cy - 11, 3, 22), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(cx + 8, cy - 11, 3, 22), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;
    }
}
