param(
    [string]$WsUrl = "ws://localhost:8080/ws/matchmaking",
    [string]$UserA = "fake_user_a",
    [string]$UserB = "fake_user_b",
    [int]$TimeoutSec = 15
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-JsonMessage([string]$loginId) {
    return (@{
        mode = "1vs1"
        loginId = $loginId
    } | ConvertTo-Json -Compress)
}

function Receive-Message([System.Net.WebSockets.ClientWebSocket]$socket, [int]$timeoutSec) {
    $buffer = New-Object byte[] 4096
    $segment = [System.ArraySegment[byte]]::new($buffer)
    $cts = [System.Threading.CancellationTokenSource]::new()
    $cts.CancelAfter([TimeSpan]::FromSeconds($timeoutSec))

    $result = $socket.ReceiveAsync($segment, $cts.Token).GetAwaiter().GetResult()
    if ($result.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
        return $null
    }

    $ms = New-Object System.IO.MemoryStream
    $ms.Write($buffer, 0, $result.Count)

    while (-not $result.EndOfMessage) {
        $result = $socket.ReceiveAsync($segment, $cts.Token).GetAwaiter().GetResult()
        $ms.Write($buffer, 0, $result.Count)
    }

    return [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
}

function Connect-Client([string]$wsUrl) {
    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $socket.ConnectAsync([Uri]$wsUrl, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    return $socket
}

Write-Host "Connecting fake clients to $WsUrl ..."
$socketA = Connect-Client $WsUrl
$socketB = Connect-Client $WsUrl

try {
    $msgA = New-JsonMessage $UserA
    $msgB = New-JsonMessage $UserB

    $bytesA = [System.Text.Encoding]::UTF8.GetBytes($msgA)
    $bytesB = [System.Text.Encoding]::UTF8.GetBytes($msgB)
    $segA = [System.ArraySegment[byte]]::new($bytesA)
    $segB = [System.ArraySegment[byte]]::new($bytesB)

    $socketA.SendAsync($segA, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $socketB.SendAsync($segB, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()

    Write-Host "Sent matchmaking requests:"
    Write-Host " - $UserA => $msgA"
    Write-Host " - $UserB => $msgB"

    $matchedA = $false
    $matchedB = $false
    $roomA = ""
    $roomB = ""
    $deadline = (Get-Date).AddSeconds($TimeoutSec)

    while ((Get-Date) -lt $deadline -and (-not ($matchedA -and $matchedB))) {
        if (-not $matchedA) {
            $rawA = Receive-Message $socketA 2
            if ($rawA) {
                Write-Host "[A] $rawA"
                $jsonA = $rawA | ConvertFrom-Json
                if ($jsonA.type -eq "MATCHED") {
                    $matchedA = $true
                    $roomA = [string]$jsonA.roomId
                }
            }
        }

        if (-not $matchedB) {
            $rawB = Receive-Message $socketB 2
            if ($rawB) {
                Write-Host "[B] $rawB"
                $jsonB = $rawB | ConvertFrom-Json
                if ($jsonB.type -eq "MATCHED") {
                    $matchedB = $true
                    $roomB = [string]$jsonB.roomId
                }
            }
        }
    }

    if ($matchedA -and $matchedB -and $roomA -eq $roomB -and $roomA -ne "") {
        Write-Host ""
        Write-Host "SUCCESS: Both fake users matched in room '$roomA'." -ForegroundColor Green
        exit 0
    }

    Write-Host ""
    Write-Host "FAILED: Matchmaking did not complete as expected." -ForegroundColor Red
    Write-Host "matchedA=$matchedA roomA='$roomA'"
    Write-Host "matchedB=$matchedB roomB='$roomB'"
    exit 1
}
finally {
    foreach ($socket in @($socketA, $socketB)) {
        if ($socket -and $socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
            $socket.CloseAsync(
                [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
                "done",
                [System.Threading.CancellationToken]::None
            ).GetAwaiter().GetResult()
        }
        if ($socket) {
            $socket.Dispose()
        }
    }
}

